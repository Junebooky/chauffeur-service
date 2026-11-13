import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export type GlassSelectOption = {
  value: string
  label: string
  meta?: string
  disabled?: boolean
}

type GlassSelectProps = {
  id?: string
  name?: string
  ariaLabel?: string
  value: string
  options: GlassSelectOption[]
  onChange: (value: string) => void
  className?: string
  compact?: boolean
  disabled?: boolean
  placeholder?: string
}

export default function GlassSelect({
  id,
  name,
  ariaLabel,
  value,
  options,
  onChange,
  className = '',
  compact = false,
  disabled = false,
  placeholder = 'Select an option',
}: GlassSelectProps) {
  const autoId = useId()
  const triggerId = id || `${autoId}-trigger`
  const listboxId = `${autoId}-listbox`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 280,
    upwards: false,
  })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const reposition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const below = viewportHeight - rect.bottom - 14
    const above = rect.top - 14
    const upwards = below < 210 && above > below
    const maxHeight = Math.max(150, Math.min(290, upwards ? above : below))
    const width = Math.max(rect.width, compact ? 185 : rect.width)
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
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    reposition()

    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }

    const handleReposition = () => reposition()

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    window.visualViewport?.addEventListener('resize', handleReposition)
    document.addEventListener('pointerdown', handleOutside)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      window.visualViewport?.removeEventListener('resize', handleReposition)
      document.removeEventListener('pointerdown', handleOutside)
    }
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open || highlightedIndex < 0) return
    const activeEl = document.getElementById(
      `${listboxId}-option-${highlightedIndex}`,
    )
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex, listboxId])

  const commit = (option: GlassSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const moveHighlight = (delta: number) => {
    if (!options.length) return
    let next = highlightedIndex
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length
      if (!options[next].disabled) {
        setHighlightedIndex(next)
        return
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        moveHighlight(1)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        moveHighlight(-1)
      }
    } else if (e.key === 'Home' && open) {
      e.preventDefault()
      const firstValid = options.findIndex((o) => !o.disabled)
      if (firstValid >= 0) setHighlightedIndex(firstValid)
    } else if (e.key === 'End' && open) {
      e.preventDefault()
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setHighlightedIndex(i)
          break
        }
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else if (highlightedIndex >= 0 && options[highlightedIndex]) {
        commit(options[highlightedIndex])
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    } else if (e.key === 'Tab' && open) {
      setOpen(false)
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const char = e.key.toLowerCase()
      const start = (highlightedIndex + 1) % options.length
      for (let i = 0; i < options.length; i++) {
        const idx = (start + i) % options.length
        const opt = options[idx]
        if (!opt.disabled && opt.label.toLowerCase().startsWith(char)) {
          if (!open) onChange(opt.value)
          else setHighlightedIndex(idx)
          break
        }
      }
    }
  }

  return (
    <div
      className={`glass-select ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && highlightedIndex >= 0
            ? `${listboxId}-option-${highlightedIndex}`
            : undefined
        }
        aria-label={ariaLabel}
        disabled={disabled}
        className="glass-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        <span className="glass-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption?.meta && !compact && (
          <span className="glass-select-value-meta">{selectedOption.meta}</span>
        )}
        <ChevronDown
          size={compact ? 15 : 17}
          className="glass-select-chevron"
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || 'Options'}
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
              const isSelected = option.value === value
              const isHighlighted = index === highlightedIndex
              return (
                <div
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  className={`glass-select-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commit(option)}
                >
                  <span className="glass-select-option-main">
                    <span className="glass-select-option-label">
                      {option.label}
                    </span>
                    {option.meta && (
                      <span className="glass-select-option-meta">
                        {option.meta}
                      </span>
                    )}
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

