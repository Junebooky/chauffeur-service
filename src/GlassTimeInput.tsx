import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type GlassTimeInputProps = {
  id?: string
  name?: string
  ariaLabel?: string
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
  compact?: boolean
  disabled?: boolean
  placeholder?: string
}

const VALID_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const TIME_VALIDATION_MESSAGE = 'Enter a valid 24-hour time (HH:MM, e.g. 10:30).'

/** Normalizes flexible 24h time strings ("9:30", "0930", "9") into HH:MM or returns null. */
export function normalizeTime(raw: string): string | null {
  const trimmed = raw.trim()
  let hours: number
  let minutes: number

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  const fourDigitMatch = trimmed.match(/^(\d{2})(\d{2})$/)
  const threeDigitMatch = trimmed.match(/^(\d)(\d{2})$/)
  const hourOnlyMatch = trimmed.match(/^(\d{1,2})$/)

  if (colonMatch) {
    hours = Number(colonMatch[1])
    minutes = Number(colonMatch[2])
  } else if (fourDigitMatch) {
    hours = Number(fourDigitMatch[1])
    minutes = Number(fourDigitMatch[2])
  } else if (threeDigitMatch) {
    hours = Number(threeDigitMatch[1])
    minutes = Number(threeDigitMatch[2])
  } else if (hourOnlyMatch) {
    hours = Number(hourOnlyMatch[1])
    minutes = 0
  } else {
    return null
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function findClosestOptionIndex(text: string, options: string[]): number {
  const trimmed = text.trim()
  if (!trimmed || !options.length) return 0
  const exact = options.indexOf(trimmed)
  if (exact >= 0) return exact
  const prefix = options.findIndex((opt) => opt.startsWith(trimmed))
  if (prefix >= 0) return prefix
  const hourMatch = trimmed.match(/^(\d{1,2})/)
  if (hourMatch) {
    const h = Math.min(23, Math.max(0, Number(hourMatch[1])))
    const hourPrefix = `${String(h).padStart(2, '0')}:00`
    const idx = options.indexOf(hourPrefix)
    if (idx >= 0) return idx
  }
  return 0
}

export default function GlassTimeInput({
  id,
  name,
  ariaLabel,
  value,
  options,
  onChange,
  className = '',
  compact = false,
  disabled = false,
  placeholder = 'HH:MM',
}: GlassTimeInputProps) {
  const autoId = useId()
  const inputId = id || `${autoId}-input`
  const listboxId = `${autoId}-listbox`
  const controlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigatedByArrow = useRef(false)

  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    findClosestOptionIndex(value, options),
  )
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 280,
    upwards: false,
  })

  useEffect(() => {
    setDraft(value)
    setInvalid(false)
    inputRef.current?.setCustomValidity('')
  }, [value])

  const reposition = () => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect) return
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const below = viewportHeight - rect.bottom - 14
    const above = rect.top - 14
    const upwards = below < 210 && above > below
    const maxHeight = Math.max(150, Math.min(290, upwards ? above : below))
    const width = Math.min(
      Math.max(rect.width, compact ? 160 : rect.width),
      viewportWidth - 24,
    )
    const clampedLeft = Math.max(
      12,
      Math.min(rect.left, viewportWidth - width - 12),
    )

    setPosition({
      left: clampedLeft,
      width,
      top: upwards ? rect.top - 8 : rect.bottom + 8,
      maxHeight,
      upwards,
    })
  }

  useEffect(() => {
    if (!open) return
    setHighlightedIndex(findClosestOptionIndex(draft, options))
    reposition()

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        !controlRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }

    const handleReposition = () => reposition()

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    window.visualViewport?.addEventListener('resize', handleReposition)
    window.visualViewport?.addEventListener('scroll', handleReposition)
    document.addEventListener('pointerdown', handleOutside)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      window.visualViewport?.removeEventListener('resize', handleReposition)
      window.visualViewport?.removeEventListener('scroll', handleReposition)
      document.removeEventListener('pointerdown', handleOutside)
    }
  }, [open])

  useEffect(() => {
    if (!open || highlightedIndex < 0) return
    const activeEl = document.getElementById(
      `${listboxId}-option-${highlightedIndex}`,
    )
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex, listboxId])

  const commitTime = (nextTime: string) => {
    setDraft(nextTime)
    setInvalid(false)
    navigatedByArrow.current = false
    if (inputRef.current) {
      inputRef.current.value = nextTime
      inputRef.current.setCustomValidity('')
    }
    if (nextTime !== value) {
      onChange(nextTime)
    }
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5)
    let next = cleaned
    if (cleaned.length > draft.length && /^\d{4}$/.test(cleaned)) {
      next = `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
    }
    setDraft(next)
    setInvalid(false)
    navigatedByArrow.current = false
    setOpen(false)
    e.currentTarget.setCustomValidity('')

    const closestIdx = findClosestOptionIndex(next, options)
    setHighlightedIndex(closestIdx)

    if (VALID_TIME_RE.test(next) && next !== value) {
      onChange(next)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalized = normalizeTime(draft)
    if (normalized) {
      setDraft(normalized)
      setInvalid(false)
      e.currentTarget.value = normalized
      e.currentTarget.setCustomValidity('')
      if (normalized !== value) {
        onChange(normalized)
      }
    } else {
      setInvalid(true)
      e.currentTarget.setCustomValidity(TIME_VALIDATION_MESSAGE)
    }
  }

  const moveHighlight = (delta: number) => {
    if (!options.length) return
    navigatedByArrow.current = true
    setHighlightedIndex((prev) => (prev + delta + options.length) % options.length)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else moveHighlight(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else moveHighlight(-1)
    } else if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      if (open && navigatedByArrow.current && options[highlightedIndex]) {
        commitTime(options[highlightedIndex])
      } else {
        const normalized = normalizeTime(draft)
        if (normalized) {
          commitTime(normalized)
        } else {
          setInvalid(true)
          inputRef.current?.setCustomValidity(TIME_VALIDATION_MESSAGE)
          inputRef.current?.reportValidity()
        }
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab' && open) {
      setOpen(false)
    }
  }

  return (
    <div
      className={`glass-select glass-time ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''} ${invalid ? 'is-invalid' : ''} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={controlRef}
        className={`glass-time-control ${invalid ? 'is-invalid' : ''}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={5}
          required
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          placeholder={placeholder}
          value={draft}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="glass-time-input"
          onFocus={() => setOpen(true)}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Toggle ${ariaLabel || 'time'} options`}
          className="glass-time-toggle"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return
            setOpen((prev) => !prev)
            inputRef.current?.focus({ preventScroll: true })
          }}
        >
          <ChevronDown
            size={compact ? 15 : 17}
            className="glass-select-chevron"
            aria-hidden="true"
          />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || 'Time options'}
            data-native-scroll
            className={`glass-select-menu ${position.upwards ? 'is-upwards' : ''}`}
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
              width: `${position.width}px`,
              maxHeight: `${position.maxHeight}px`,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option === value
              const isHighlighted = index === highlightedIndex
              return (
                <div
                  key={option}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`glass-select-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    commitTime(option)
                    inputRef.current?.focus({ preventScroll: true })
                  }}
                >
                  <span className="glass-select-option-main">
                    <span className="glass-select-option-label">{option}</span>
                  </span>
                  {isSelected && (
                    <Check
                      size={15}
                      className="glass-select-check"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
