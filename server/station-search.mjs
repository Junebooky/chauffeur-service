// Station-aware search helpers. Presentation and ranking never mutate canonical
// place addresses or coordinates used by reservation validation.
const STATION_TYPES = new Set([
  'subway_station', 'train_station', 'light_rail_station', 'transit_station',
])
const EXIT_WORDS = /\b(?:exit|gate|salida|sortie|ausgang)\s*(?:no\.?\s*|#)?(\d+)\b|(?:출구\s*(\d+)|(?:\b|\s)(\d+)\s*번\s*출구)|(?:出口|出入口)\s*(\d+)/iu
const EXIT_TEXT = /\b(?:exit|gate|salida|sortie|ausgang)\b|출구|出口|出入口/iu
const NON_STATION = /\b(?:shopping|mall|market|store|restaurant|hotel|parking|bus stop|exit|gate)\b|지하상가|쇼핑|상가|출구|出口|出入口/iu
const STATION_WORD = /\b(?:station|estaci[oó]n|estação|bahnhof|gare)\b|역(?:$|\s)|駅|站(?:$|\s)|車站|车站/iu

export const normalizePlaceQuery = (value) => value
  .normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '')
  .toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export function languageForQuery(query) {
  if (/\p{Script=Hangul}/u.test(query)) return 'ko'
  if (/[\p{Script=Hiragana}\p{Script=Katakana}駅]/u.test(query)) return 'ja'
  if (/[\p{Script=Han}]/u.test(query)) return 'zh-CN'
  if (/\bestaci[oó]n\b|\bsalida\s*\d+/iu.test(query)) return 'es'
  if (/\bestação\b/iu.test(query)) return 'pt'
  if (/\bgare\s+(?:de|du|d')\b|\bsortie\s*\d+/iu.test(query)) return 'fr'
  if (/\bbahnhof\b|\bausgang\s*\d+/iu.test(query)) return 'de'
  return 'en'
}

export function exitNumber(value) {
  const match = value.match(EXIT_WORDS)
  const number = match?.slice(1).find(Boolean)
  return number ? Number(number) : null
}

export function stationSearchContext(query) {
  const trimmed = query.trim()
  const exit = EXIT_TEXT.test(trimmed)
  const station = STATION_WORD.test(trimmed)
  const languageCode = languageForQuery(trimmed)
  let input = trimmed
  // Translate only station expressions; never translate a general place name.
  if (!exit) {
    const prefix = trimmed.match(/^(?:estaci[oó]n|estação)\s+(?:(?:de|do|da|del|de la)\s+)?(.+)$/iu)
      || trimmed.match(/^(?:gare\s+(?:de|du|d')|bahnhof\s+)(.+)$/iu)
    if (prefix?.[1]) input = `${prefix[1].trim()} Station`
  }
  return { input, languageCode, station, exit, requestedExit: exitNumber(trimmed) }
}

export function isStationPrediction(suggestion) {
  const name = suggestion.name || ''
  if (NON_STATION.test(name) || EXIT_TEXT.test(name)) return false
  const types = suggestion.types || []
  const strong = types.some((type) =>
    type === 'subway_station' || type === 'train_station' || type === 'light_rail_station')
  const generic = types.some((type) => STATION_TYPES.has(type))
  // Transit-only predictions can include bus stops: require a station name.
  return strong || (generic && STATION_WORD.test(name)) ||
    (!types.length && STATION_WORD.test(name))
}

export function rankStationSuggestions(results, context) {
  if (!context.station && !context.exit) return results
  return results
    .map((suggestion, index) => {
      const name = suggestion.name || ''
      const station = isStationPrediction(suggestion)
      const exit = EXIT_TEXT.test(name)
      const exactExit = context.requestedExit !== null &&
        exitNumber(name) === context.requestedExit
      const priority = context.exit
        ? exactExit ? 0 : exit ? 1 : station ? 2 : 3
        : station ? 0 : exit ? 1 : 2
      return { suggestion, index, priority }
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ suggestion }) => suggestion)
}

export function stationDisplayAddress(address, isStation) {
  if (!isStation || typeof address !== 'string') return address
  return address
    .replace(/^\s*(?:B|지하\s*)(\d+)\s*,?\s*/iu, '$1, ')
    .replace(/^(\d+)\s+(?=[A-Za-z].*-ro\b)/u, '$1, ')
    .replace(/,?\s*(?:South Korea|Republic of Korea)\s*$/iu, '')
    .trim()
}
