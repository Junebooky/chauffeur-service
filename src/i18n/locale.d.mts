export type Locale = 'en' | 'ko'
export function pathLocale(path: string): Locale | null
export function resolveLocale(input?: {path?: string}): Locale
