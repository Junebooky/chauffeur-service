import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { resolveLocale } from './locale.mjs'
import type { Locale } from './locale.mjs'
import { ko } from './ko'
import { localeSeo, origin } from './seo.mjs'
import { trackLanguageSwitch, trackPageView } from '../analytics.mjs'

function current() {
  return resolveLocale({ path: location.pathname })
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
    trackLanguageSwitch(locale, next)
    changePath(next, false)
    update(next)
  }, [locale])
  useEffect(() => {
    const onPop = () => update(current())
    window.addEventListener('popstate', onPop)
    // Preserve the English customer route; SEO canonical remains the root URL.
    if (location.pathname === '/') changePath('en', true)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    const meta = localeSeo[locale]
    document.title = meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', meta.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.description)
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', meta.ogLocale)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', origin + (locale === 'ko' ? '/ko/' : '/'))
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', origin + (locale === 'ko' ? '/ko/' : '/'))
    trackPageView('/' + locale + '/', meta.title, locale)
    return () => { document.documentElement.lang = 'en' }
  }, [locale])
  const t = useCallback((english: string) => locale === 'ko' ? (Object.hasOwn(ko, english) ? ko[english] : english) : english, [locale])
  return <Context.Provider value={{ locale, setLocale, t }}>{children}</Context.Provider>
}
