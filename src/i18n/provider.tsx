import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { pathLocale, resolveLocale } from './locale.mjs'
import type { Locale } from './locale.mjs'
import { ko } from './ko'

const KEY = 'chauffeur.locale'
function preference() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
function current(country?: string) {
  return resolveLocale({ path: location.pathname, preference: preference(), languages: navigator.languages, country })
}
function changePath(locale: Locale, replace: boolean) {
  const url = '/' + locale + '/' + location.search + location.hash
  if (location.pathname === '/' + locale + '/') return
  if (replace) history.replaceState(history.state, '', url)
  else history.pushState(history.state, '', url)
}
type LocaleContext = { locale: Locale; setLocale: (locale: Locale) => void; t: (english: string) => string }
const Context = createContext<LocaleContext>({ locale: 'en', setLocale: () => {}, t: (english) => english })
export function useLocale() { return useContext(Context) }
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, update] = useState(() => current())
  const setLocale = useCallback((next: Locale) => {
    try { localStorage.setItem(KEY, next) } catch { /* optional storage */ }
    changePath(next, false)
    update(next)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    return () => { document.documentElement.lang = 'en' }
  }, [locale])
  useEffect(() => {
    const controller = new AbortController()
    const onPop = () => update(current())
    window.addEventListener('popstate', onPop)
    if (location.pathname === '/') {
      const known = ['en', 'ko'].includes(preference() ?? '') || navigator.languages.some(l => /^(ko|en)(-|$)/i.test(l))
      if (known) changePath(current(), true)
      else {
        fetch('/api/locale', { signal: controller.signal, cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (controller.signal.aborted || pathLocale(location.pathname) || location.pathname !== '/') return
            const next = current(data?.country)
            changePath(next, true)
            update(next)
          })
          .catch(() => { if (!controller.signal.aborted && location.pathname === '/') changePath(current(), true) })
      }
    }
    return () => { controller.abort(); window.removeEventListener('popstate', onPop) }
  }, [])
  const t = useCallback((english: string) => locale === 'ko' ? (Object.hasOwn(ko, english) ? ko[english] : english) : english, [locale])
  return <Context.Provider value={{ locale, setLocale, t }}>{children}</Context.Provider>
}
