import { computed, ref, watch } from 'vue'
import { en as uiEn, es as uiEs, pt_br as uiPt } from '@nuxt/ui/locale'
import { localeOf, translate, type Params } from '@shared/i18n'
import type { Lang } from '@shared/types'
import { langState } from './langState'

/** Current UI language. Reading it inside t() makes every translated string reactive. */
export const lang = ref<Lang>('pt')
watch(lang, (l) => (langState.lang = l), { immediate: true })

export function t(pt: string, params?: Params): string {
  return translate(lang.value, pt, params)
}

/** Locale for dates and numbers (pt-BR, en-US, es-ES). */
export const locale = computed(() => localeOf(lang.value))

/** Nuxt UI's own strings (close buttons, empty states). */
export const uiLocale = computed(() => ({ pt: uiPt, en: uiEn, es: uiEs })[lang.value])
