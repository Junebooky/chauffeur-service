import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, MapPin, Search } from 'lucide-react'

export type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  source: string
  selectionToken?: string
}
type Suggestion = Pick<Place, 'id' | 'name' | 'address'>

type Props = {
  name: string
  label: string
  value: string
  place: Place | null
  onChange: (value: string, place: Place | null) => void
}
export default function AddressSearch({
  name,
  label,
  value,
  place,
  onChange,
}: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const session = useRef(crypto.randomUUID())
  const requestVersion = useRef(0)
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
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

  useEffect(() => {
    input.current?.setCustomValidity(
      value && !place
        ? 'Choose a place from the suggestions to confirm its address.'
        : '',
    )
  }, [value, place])
  useEffect(() => {
    if (!open || place || composing) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setResults([])
    setHighlight(-1)
    const timer = setTimeout(() => {
      fetch('/api/places/search', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value, sessionToken: session.current }),
      })
        .then(async (response) => {
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
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, open, place, composing])
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const rect = input.current?.getBoundingClientRect()
      if (!rect) return
      const viewportHeight = window.visualViewport?.height || innerHeight
      const below = viewportHeight - rect.bottom - 16
      const above = rect.top - 16
      const upwards = below < 180 && above > below
      const maxHeight = Math.min(310, upwards ? above : below)
      setPosition({
        left: rect.left,
        width: rect.width,
        top: upwards ? rect.top - maxHeight - 6 : rect.bottom + 6,
        maxHeight: Math.max(100, maxHeight),
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
    document.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('resize', reposition)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])

  useEffect(() => {
    if (open && highlight >= 0)
      document
        .getElementById(`${id}-option-${highlight}`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open, id])

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
        <MapPin size={13} /> {label}
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
          placeholder="Airport, hotel or address in any language"
          onFocus={() => {
            if (!place) setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onChange={(e) => {
            requestVersion.current++
            setResolving(false)
            onChange(e.target.value, null)
            setOpen(true)
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
                results.length
                  ? (previous +
                      (e.key === 'ArrowDown' ? 1 : -1) +
                      results.length) %
                    results.length
                  : -1,
              )
            }
            if (e.key === 'Enter' && open && !place) {
              e.preventDefault()
              if (results[highlight]) void select(results[highlight])
            }
          }}
        />
        {place && (
          <Check size={14} className="address-check" aria-hidden="true" />
        )}
      </div>
      <p id={`${id}-help`} className="address-help">
        {place
          ? place.address
          : 'English, Korean or your own language · South Korea'}
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
            <div className="address-popup-heading">
              <Search size={12} />{' '}
              {mode === 'google'
                ? 'PLACES IN SOUTH KOREA'
                : 'POPULAR LOCATIONS'}
            </div>
            <div role="status" className="address-status">
              {loading || resolving ? (
                <>
                  <LoaderCircle size={12} className="spin" />{' '}
                  {resolving
                    ? 'Confirming address…'
                    : 'Finding your destination…'}
                </>
              ) : (
                error || notice || 'Select a location to confirm its address.'
              )}
            </div>
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label={`${label} suggestions`}
            >
              {!loading &&
                results.map((result, index) => (
                  <div
                    key={result.id}
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
                    <MapPin size={14} />
                    <span>
                      {result.name}
                      <small>{result.address}</small>
                    </span>
                  </div>
                ))}
              {!loading && !results.length && !error && (
                <p className="address-empty">
                  No matches. Try a hotel, airport terminal or a more specific
                  address.
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
