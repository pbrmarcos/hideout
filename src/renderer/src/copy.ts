import { reactive } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { api, ApiError } from './api'
import { t } from './i18n'
import { S } from './store'

/** Which secret is currently on the clipboard, to draw the draining bar on its seal. */
export const copied = reactive({ key: '', startedAt: 0, ms: 0 })
let timer: ReturnType<typeof setTimeout> | null = null

export function useCopy() {
  const toast = useToast()

  async function copy(text: string, opts: { key?: string; secret?: boolean; label: string }): Promise<void> {
    if (!text) return
    const secret = opts.secret ?? false
    await api('clip:copy', text, secret)
    const secs = S.app?.settings.clipboardSeconds ?? 30
    if (secret && opts.key) {
      copied.key = opts.key
      copied.startedAt = Date.now()
      copied.ms = secs * 1000
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => (copied.key = ''), copied.ms)
      // The seal itself shows "Copiada" and drains while the secret is on the clipboard.
      if (document.querySelector(`[data-seal="${CSS.escape(opts.key)}"]`)) return
    }
    toast.add({
      title: t('{what} copiado', { what: opts.label }),
      description: secret ? t('Sai da área de transferência em {secs} segundos.', { secs }) : undefined,
      icon: 'i-lucide-check',
      duration: 2500
    })
  }

  function fail(e: unknown): void {
    toast.add({ title: e instanceof ApiError ? e.message : t('Algo deu errado.'), color: 'error', icon: 'i-lucide-circle-alert', duration: 4000 })
  }

  function info(title: string, description?: string): void {
    toast.add({ title, description, icon: 'i-lucide-check', duration: 2500 })
  }

  return { copy, fail, info, toast }
}
