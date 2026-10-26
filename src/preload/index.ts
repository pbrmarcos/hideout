import { contextBridge, ipcRenderer, webUtils } from 'electron'

type Reply<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }

const call = <T = unknown>(channel: string, ...args: unknown[]): Promise<Reply<T>> => ipcRenderer.invoke(channel, ...args)

const on = (channel: string, fn: (payload: never) => void): (() => void) => {
  const listener = (_e: unknown, payload: unknown): void => fn(payload as never)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  call,
  on,
  pathForFile: (file: File): string => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('hideout', api)

export type HideoutApi = typeof api
