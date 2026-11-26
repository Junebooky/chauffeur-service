import { useLocale } from './i18n/provider'
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, MapPin, Navigation, Search, TrainFront } from 'lucide-react'

export type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source: string
  selectionToken?: string
  displayAddress?: string
  isStation?: boolean
}
type Suggestion = Pick<Place, 'id' | 'name' | 'address' | 'displayAddress' | 'isStation'>
type DisplaySuggestion = Suggestion & { fromTrip?: boolean }
const normalizeQuery = (text: string) =>
  text.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

type Props = {
  name: string
  label: string
  value: string
  place: Place | null
  placeholder?: string
  rightIcon?: 'pin' | 'nav' | 'none'
  labelIcon?: boolean
  /** Verified places selected in this booking; never stored between sessions. */
  recentPlaces?: Place[]
  onChange: (value: string, place: Place | null) => void
}
export default function AddressSearch({
  name,
  label,
  value,
  place,
  placeholder = 'Airport, hotel or address in any language',
  rightIcon = 'none',
  labelIcon = true,
  recentPlaces = [],
  onChange,
}: Props) {
  const { locale, t } = useLocale()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const session = useRef(crypto.randomUUID())
  const requestVersion = useRef(0)
  const justCompletedComposition = useRef(false)
  const composing = useRef(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [results, setResults] = useState<Suggestion[]>([])
  const [mode, setMode] = useState('popular')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 280,
  })

  // Render booking selections immediately, before any live Google results.
  // Suggestions are displayed locally but re-resolved through the existing
  // server verification endpoint before being accepted into another day.
  const queryKey = normalizeQuery(value.trim())
  const seenRecent = new Set<string>()
  const recentMatches = recentPlaces.filter((candidate) => {
    if (!candidate?.id || seenRecent.has(candidate.id) || candidate.id === place?.id)
      return false
    seenRecent.add(candidate.id)
    return !queryKey || [candidate.name, candidate.address, candidate.displayAddress || '']
      .some((text) => normalizeQuery(text).includes(queryKey))
  }).slice(0, 6)
  const recentIds = new Set(recentMatches.map((candidate) => candidate.id))
  const visibleResults: DisplaySuggestion[] = [
    ...recentMatches.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      address: candidate.address,
      displayAddress: candidate.displayAddress,
      isStation: candidate.isStation,
      fromTrip: true,
    })),
    ...(!loading ? results.filter((result) => !recentIds.has(result.id)) : []),
  ]

  useEffect(() => {
    input.current?.setCustomValidity(
      value && !place
        ? 'Choose a place from the suggestions to confirm its address.'
        : '',
    )
  }, [value, place])
  useEffect(() => {
    // Important: do not block search while a Korean IME composition is active.
    // Some browsers keep composition open until a click/blur; blocking it
    // causes an apparent 'search only after clicking again' delay.
    if (!open || place) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setResults([])
    setHighlight(-1)
    // Live suggestions appear during ongoing Korean composition, not only
    // after it ends. Debounce keeps paid Google requests bounded.
    const delay = justCompletedComposition.current
      ? 0
      : /\p{Script=Hangul}/u.test(value) ? 130 : 250
    justCompletedComposition.current = false
    const timer = setTimeout(() => {
      fetch('/api/places/search', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value, sessionToken: session.current }),
      })
        .then(async (response) => {
          if (!(response.headers.get('content-type') || '').includes('application/json'))
            throw new Error('Address search is unavailable. Please try again.')
          const data = await response.json()
          if (!response.ok)
            throw new Error(data.error || 'Address search is unavailable.')
          return data
        })
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.results)
            setMode(data.mode)
            setNotice(data.notice || '')
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted)
            setError(
              err instanceof TypeError
                ? 'Address search is unavailable. Please try again.'
                : err.message,
            )
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, open, place])
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const rect = input.current?.getBoundingClientRect()
      if (!rect) return
      const viewportHeight = window.visualViewport?.height || innerHeight
      const viewportWidth = window.visualViewport?.width || innerWidth
      const below = viewportHeight - rect.bottom - 16
      const above = rect.top - 16
      const upwards = below < 180 && above > below
      const maxHeight = Math.max(100, Math.min(430, upwards ? above : below))
      const width = Math.min(rect.width, viewportWidth - 24)
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12))
      setPosition({
        left,
        width,
        top: upwards ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
        maxHeight,
      })
    }
    const outside = (e: PointerEvent) => {
      if (
        !input.current?.contains(e.target as Node) &&
        !popup.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    document.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])

  useEffect(() => {
    if (open && highlight >= 0)
      document
        .getElementById(`${id}-option-${highlight}`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open, id])

  const updateQuery = (next: string) => {
    if (next === value && !place) return
    // Typing invalidates any in-flight selection. The request effect aborts
    // stale lookups so old results cannot replace newer Korean input.
    requestVersion.current++
    setResolving(false)
    onChange(next, null)
    setOpen(true)
  }

  const select = async (suggestion: Suggestion) => {
    if (resolving) return
    const version = ++requestVersion.current
    setResolving(true)
    setError('')
    try {
      const response = await fetch('/api/places/resolve', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.id,
          sessionToken: session.current,
        }),
      })
      if (!(response.headers.get('content-type') || '').includes('application/json'))
        throw new Error('Address confirmation is unavailable. Please try again.')
      const selected = await response.json()
      if (!response.ok)
        throw new Error(selected.error || 'We could not confirm this address.')
      if (version !== requestVersion.current) return
      onChange(selected.name, selected)
      setOpen(false)
      session.current = crypto.randomUUID()
    } catch (err) {
      if (version === requestVersion.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Please select the location again.',
        )
    } finally {
      if (version === requestVersion.current) setResolving(false)
    }
  }
  return (
    <div className={`field address-field ${place ? 'has-place' : ''}`}>
      <label htmlFor={id}>
        {labelIcon && <MapPin size={13} aria-hidden="true" />} {t(label)}
      </label>
      <div className="address-control">
        <input
          ref={input}
          id={id}
          name={name}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !place}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            highlight >= 0 ? `${id}-option-${highlight}` : undefined
          }
          aria-describedby={`${id}-help`}
          required
          maxLength={180}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={t(placeholder)}
          onFocus={() => {
            if (!place) setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onCompositionStart={() => {
            composing.current = true
          }}
          onInput={(event) => {
            // input fires for intermediate Hangul syllables even when the
            // compositionend event is deferred until the next mouse click.
            if (composing.current || (event.nativeEvent as InputEvent).isComposing)
              updateQuery(event.currentTarget.value)
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            // If the final committed value is new, request it immediately.
            // If onInput already synchronized it, keep the existing request:
            // restarting it would just add latency and extra Google calls.
            if (event.currentTarget.value !== value) {
              justCompletedComposition.current = true
              updateQuery(event.currentTarget.value)
            }
          }}
          onChange={(event) => {
            // onInput has already synchronized each composing character.
            if (!composing.current && !(event.nativeEvent as InputEvent).isComposing)
              updateQuery(event.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setHighlight((previous) =>
                visibleResults.length
                  ? (previous +
                      (e.key === 'ArrowDown' ? 1 : -1) +
                      visibleResults.length) %
                    visibleResults.length
                  : -1,
              )
            }
            if (e.key === 'Enter' && open && !place) {
              e.preventDefault()
              if (visibleResults[highlight]) void select(visibleResults[highlight])
            }
          }}
        />
        {place ? (
          <Check size={15} className="address-check" aria-hidden="true" />
        ) : rightIcon === 'nav' ? (
          <Navigation
            size={15}
            className="address-end-icon"
            aria-hidden="true"
          />
        ) : rightIcon === 'pin' ? (
          <MapPin size={15} className="address-end-icon" aria-hidden="true" />
        ) : null}
      </div>
      <p
        id={`${id}-help`}
        className={`address-help ${place ? 'resolved' : ''}`}
      >
        {place
          ? (place.displayAddress || place.address)
          : t('English, Korean or your own language · South Korea')}
      </p>
      {open &&
        !place &&
        createPortal(
          <div
            ref={popup}
            className="address-popup"
            style={position}
            data-native-scroll
          >
            <div className={`address-popup-heading ${recentMatches.length ? 'is-trip-recent' : ''}`}>
              {recentMatches.length
                ? <span className="address-trip-heading-rule" aria-hidden="true" />
                : <Search size={12} />}
              {' '}
              {recentMatches.length
                ? t('RECENT FROM THIS TRIP')
                : mode === 'google'
                  ? t('PLACES IN SOUTH KOREA')
                  : t('POPULAR LOCATIONS')}
            </div>
            <div role="status" className="address-status">
              {loading || resolving ? (
                <>
                  <LoaderCircle size={12} className="spin" />{' '}
                  {resolving
                    ? t('Confirming address…')
                    : t('Finding your destination…')}
                </>
              ) : (
                t(error || notice || 'Select a location to confirm its address.')
              )}
            </div>
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label={locale === 'ko' ? `${t(label)} 검색 결과` : `${label} suggestions`}
            >
              {visibleResults.map((result, index) => (
                <Fragment key={`${result.fromTrip ? 'trip' : 'search'}-${result.id}`}>
                  {index === recentMatches.length && recentMatches.length > 0 && (
                    <div className="address-popup-heading address-more-places-heading" role="presentation">
                      {mode === 'google' ? t('PLACES IN SOUTH KOREA') : t('SUGGESTED PLACES')}
                    </div>
                  )}
                  <div
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={highlight === index}
                    aria-disabled={resolving}
                    className={`address-result ${highlight === index ? 'highlighted' : ''}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => {
                      if (!resolving) void select(result)
                    }}
                  >
                    {result.isStation
                      ? <TrainFront size={14} aria-hidden="true" />
                      : <MapPin size={14} aria-hidden="true" />}
                    <span>
                      {result.name}
                      <small>{result.displayAddress || result.address}</small>
                    </span>
                  </div>
                </Fragment>
              ))}
              {!loading && !visibleResults.length && !error && (
                <p className="address-empty">
                  {t("No matches. Try a hotel, airport terminal or a more specific address.")}
                </p>
              )}
            </div>
            {mode === 'google' && (
              <div className="places-attribution">
                <img
                  src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                  alt="Powered by Google"
                />
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
