import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

/**
 * One long-lived Windows PowerShell process (STA) that does what Electron cannot:
 * - put text on the clipboard flagged so Windows clipboard history (Win+V) and cloud sync skip it;
 * - read the foreground window and the focused field (for auto-type) and type into it.
 * Commands and replies are one JSON object per line; text travels base64-encoded.
 */
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
public static class HxWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint data; public uint flags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);

  static void Send(ushort vk, ushort scan, uint flags) {
    var i = new INPUT { type = 1 };
    i.u.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags };
    SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT)));
  }
  // KEYEVENTF_UNICODE types the character itself, whatever the keyboard layout (ABNT2, US, dead keys).
  public static void Text(string s) {
    foreach (char c in s) { Send(0, c, 4); Send(0, c, 4 | 2); Thread.Sleep(6); }
  }
  public static void Key(ushort vk, bool shift) {
    if (shift) Send(0x10, 0, 0);
    Send(vk, 0, 0); Send(vk, 0, 2);
    if (shift) Send(0x10, 0, 2);
  }

  // The shortcut fires while Ctrl+Alt are still down; typing then would turn Tab into Ctrl+Tab (next browser tab).
  public static bool WaitKeysUp(int ms) {
    int[] keys = { 0x10, 0x11, 0x12, 0x5B, 0x5C };
    for (int t = 0; t < ms; t += 20) {
      bool down = false;
      foreach (int k in keys) if ((GetAsyncKeyState(k) & 0x8000) != 0) down = true;
      if (!down) { Thread.Sleep(40); return true; }
      Thread.Sleep(20);
    }
    return false;
  }

  // Windows refuses SetForegroundWindow from a background process unless it shares input with the foreground thread.
  public static bool Focus(IntPtr h) {
    if (GetForegroundWindow() == h) return true;
    if (IsIconic(h)) ShowWindow(h, 9);
    uint pid;
    uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    uint me = GetCurrentThreadId();
    bool attached = fg != me && AttachThreadInput(me, fg, true);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    if (attached) AttachThreadInput(me, fg, false);
    for (int i = 0; i < 25; i++) { if (GetForegroundWindow() == h) return true; Thread.Sleep(20); }
    return false;
  }
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
# What has keyboard focus: password, text (an editable field), address (browser address bar), other or unknown.
function FocusKind {
  try {
    $e = [Windows.Automation.AutomationElement]::FocusedElement
    if (-not $e) { return 'unknown' }
    $cur = $e.Current
    if ($cur.IsPassword) { return 'password' }
    if ([string]$cur.ClassName -match 'Omnibox|LocationBar' -or [string]$cur.AutomationId -in @('urlbar-input', 'addressEditBox')) { return 'address' }
    $ct = $cur.ControlType
    if ($ct -eq [Windows.Automation.ControlType]::Edit -or $ct -eq [Windows.Automation.ControlType]::ComboBox) {
      $vp = $null
      if ($e.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and $vp.Current.IsReadOnly) { return 'other' }
      return 'text'
    }
    return 'other'
  } catch { return 'unknown' }
}
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
      'prepare' {
        $released = [HxWin]::WaitKeysUp(3000)
        $focused = [HxWin]::Focus([IntPtr][long]$c.hwnd)
        $kind = 'unknown'
        if ($focused) {
          Start-Sleep -Milliseconds 60
          $kind = FocusKind
          # Chromium builds its accessibility tree on the first request, and a window that just came back
          # to the front restores its focused field a moment later: ask again for up to about a second.
          for ($i = 0; $i -lt 5 -and ($kind -eq 'other' -or $kind -eq 'unknown'); $i++) { Start-Sleep -Milliseconds 220; $kind = FocusKind }
        }
        Reply $c.id $true @{ released = $released; focused = $focused; kind = $kind }
      }
      'kind' {
        Reply $c.id $true (FocusKind)
      }
      'keys' {
        foreach ($s in $c.steps) {
          switch ($s.key) {
            'TAB' { [HxWin]::Key(0x09, $false) }
            'SHIFT_TAB' { [HxWin]::Key(0x09, $true) }
            'ENTER' { [HxWin]::Key(0x0D, $false) }
            default { [HxWin]::Text((B64 $s.text)) }
          }
          Start-Sleep -Milliseconds 60
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

export type TypeStep = { text: string } | { key: 'TAB' | 'SHIFT_TAB' | 'ENTER' }
export type FocusKind = 'password' | 'text' | 'address' | 'other' | 'unknown'
export interface Prepared {
  released: boolean
  focused: boolean
  kind: FocusKind
}

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

  /** Waits for the shortcut keys to be released, brings `hwnd` to the front and says what field has focus. */
  prepare(hwnd: number): Promise<Prepared> {
    return this.call('prepare', { hwnd })
  }

  focusKind(): Promise<FocusKind> {
    return this.call('kind')
  }

  keys(steps: TypeStep[]): Promise<void> {
    const encoded = steps.map((s) => ('text' in s ? { text: Buffer.from(s.text).toString('base64') } : s))
    return this.call('keys', { steps: encoded })
  }

  dispose(): void {
    this.proc?.kill()
  }
}

export const winHelper = new WinHelper()
