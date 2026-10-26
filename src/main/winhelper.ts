import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

/**
 * One long-lived Windows PowerShell process (STA) that does what Electron cannot:
 * - put text on the clipboard flagged so Windows clipboard history (Win+V) and cloud sync skip it;
 * - read the foreground window (for auto-type) and send keystrokes to it.
 * Commands and replies are one JSON object per line; text travels base64-encoded.
 */
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class HxWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", SetLastError = true)] public static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] public static extern bool EmptyClipboard();
  [DllImport("user32.dll")] public static extern bool CloseClipboard();
  // Ownerless clear: Clipboard.Clear() leaves an OLE owner window that never pumps messages,
  // which makes every other app wait when it reads the clipboard.
  public static bool Wipe() {
    for (int i = 0; i < 20; i++) {
      if (OpenClipboard(IntPtr.Zero)) { EmptyClipboard(); CloseClipboard(); return true; }
      System.Threading.Thread.Sleep(50);
    }
    return false;
  }
}
"@
function B64([string]$s) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)) }
function Zero() { New-Object IO.MemoryStream (,[byte[]](0,0,0,0)) }
function Reply($id, $ok, $value) { [Console]::Out.WriteLine((@{ id = $id; ok = $ok; value = $value } | ConvertTo-Json -Compress)) }
function Esc([string]$t) { ($t.ToCharArray() | ForEach-Object { if ('+^%~(){}[]'.Contains($_)) { '{' + $_ + '}' } else { [string]$_ } }) -join '' }
[Console]::Out.WriteLine('{"ready":true}')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $c = $line | ConvertFrom-Json
  try {
    switch ($c.op) {
      'clip' {
        $d = New-Object Windows.Forms.DataObject
        $d.SetData([Windows.Forms.DataFormats]::UnicodeText, (B64 $c.text))
        if ($c.secret) {
          $d.SetData('ExcludeClipboardContentFromMonitorProcessing', (Zero))
          $d.SetData('CanIncludeInClipboardHistory', (Zero))
          $d.SetData('CanUploadToCloudClipboard', (Zero))
        }
        [Windows.Forms.Clipboard]::SetDataObject($d, $true, 5, 60)
        Reply $c.id $true $null
      }
      'clearIf' {
        $cur = [Windows.Forms.Clipboard]::GetText()
        if ($cur -eq (B64 $c.text)) { [void][HxWin]::Wipe() }
        Reply $c.id $true $null
      }
      'fg' {
        $h = [HxWin]::GetForegroundWindow()
        $sb = New-Object Text.StringBuilder 512
        [void][HxWin]::GetWindowText($h, $sb, 512)
        $procId = [uint32]0
        [void][HxWin]::GetWindowThreadProcessId($h, [ref]$procId)
        $name = ''
        try { $name = (Get-Process -Id $procId).ProcessName } catch {}
        Reply $c.id $true @{ hwnd = $h.ToInt64(); title = $sb.ToString(); process = $name; pid = $procId }
      }
      'type' {
        if ($c.hwnd) { [void][HxWin]::SetForegroundWindow([IntPtr][long]$c.hwnd); Start-Sleep -Milliseconds 150 }
        foreach ($s in $c.steps) {
          if ($s.key) { [Windows.Forms.SendKeys]::SendWait('{' + $s.key + '}') }
          else { [Windows.Forms.SendKeys]::SendWait((Esc (B64 $s.text))) }
          Start-Sleep -Milliseconds 40
        }
        Reply $c.id $true $null
      }
      default { Reply $c.id $false 'unknown op' }
    }
  } catch { Reply $c.id $false $_.Exception.Message }
}
`

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export interface ForegroundWindow {
  hwnd: number
  title: string
  process: string
  pid: number
}

export type TypeStep = { text: string } | { key: 'TAB' | 'ENTER' }

class WinHelper {
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private seq = 0
  private waiting = new Map<number, Pending>()

  private start(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      // -EncodedCommand does not read commands from stdin reliably, so the script runs from a file.
      const file = join(tmpdir(), `hideout-helper-${process.pid}.ps1`)
      writeFileSync(file, '﻿' + SCRIPT, 'utf8')
      const proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true })
      this.proc = proc
      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        let msg: { ready?: boolean; id?: number; ok?: boolean; value?: unknown }
        try { msg = JSON.parse(line) } catch { return }
        if (msg.ready) return resolve()
        const p = this.waiting.get(msg.id!)
        if (!p) return
        this.waiting.delete(msg.id!)
        msg.ok ? p.resolve(msg.value) : p.reject(new Error(String(msg.value)))
      })
      proc.on('exit', () => {
        this.proc = null
        this.ready = null
        for (const p of this.waiting.values()) p.reject(new Error('helper exited'))
        this.waiting.clear()
        reject(new Error('helper exited'))
      })
    })
    return this.ready
  }

  private async call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.start()
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.proc!.stdin.write(JSON.stringify({ id, op, ...args }) + '\n')
      setTimeout(() => {
        if (this.waiting.delete(id)) reject(new Error('helper timeout'))
      }, 8000)
    })
  }

  warmUp(): void {
    this.start().catch(() => {})
  }

  setClipboard(text: string, secret: boolean): Promise<void> {
    return this.call('clip', { text: Buffer.from(text).toString('base64'), secret })
  }

  clearClipboardIf(text: string): Promise<void> {
    return this.call('clearIf', { text: Buffer.from(text).toString('base64') })
  }

  foreground(): Promise<ForegroundWindow> {
    return this.call('fg')
  }

  type(hwnd: number | null, steps: TypeStep[]): Promise<void> {
    const encoded = steps.map((s) => ('text' in s ? { text: Buffer.from(s.text).toString('base64') } : s))
    return this.call('type', { hwnd, steps: encoded })
  }

  dispose(): void {
    this.proc?.kill()
  }
}

export const winHelper = new WinHelper()
