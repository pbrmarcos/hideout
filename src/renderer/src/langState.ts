import type { Lang } from '@shared/types'

/** Plain (non-Vue) copy of the UI language, so pure helpers like format.ts can use it in tests too. */
export const langState: { lang: Lang } = { lang: 'pt' }
