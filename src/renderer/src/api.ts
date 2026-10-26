import type { HideoutApi } from '../../preload'

declare global {
  interface Window {
    hideout: HideoutApi
  }
}

export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
  }
}

/** Calls the main process; throws ApiError with a user-facing message on failure. */
export async function api<T = void>(channel: string, ...args: unknown[]): Promise<T> {
  const r = await window.hideout.call<T>(channel, ...args.map((a) => (a === undefined ? a : JSON.parse(JSON.stringify(a)))))
  if (!r.ok) throw new ApiError(r.error, r.code)
  return r.value
}

export const onMain = (channel: string, fn: (payload: never) => void): (() => void) => window.hideout.on(channel, fn)
