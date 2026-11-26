export function pathLocale(path) {
  const clean = path.replace(/\/$/, '')
  return clean === '/ko' ? 'ko' : clean === '/en' ? 'en' : null
}

// English is the default entry experience, independent of country, browser
// language or a previously selected locale. Only an explicit /ko URL selects Korean.
export function resolveLocale({ path = '/' } = {}) {
  return pathLocale(path) || 'en'
}
