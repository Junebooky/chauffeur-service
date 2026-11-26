export function pathLocale(path) {
  const clean = path.replace(/\/$/, '')
  return clean === '/ko' ? 'ko' : clean === '/en' ? 'en' : null
}
export function resolveLocale({ path = '/', preference, languages = [], country } = {}) {
  const explicit = pathLocale(path)
  if (explicit) return explicit
  if (preference === 'ko' || preference === 'en') return preference
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'ko' || base === 'en') return base
  }
  return country === 'KR' ? 'ko' : 'en'
}
