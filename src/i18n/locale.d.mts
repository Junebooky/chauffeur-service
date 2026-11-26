export type Locale = 'en' | 'ko'
export function pathLocale(path: string): Locale | null
export function resolveLocale(input?: {path?: string; preference?: string | null; languages?: readonly string[]; country?: string | null}): Locale
