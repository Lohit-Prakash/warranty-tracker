import React, { useCallback, useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'
import { useUITheme } from '../../hooks/useUITheme'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const { isMaterial } = useUITheme()
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    // ── Material Web branch ──────────────────────────────────────────────
    if (isMaterial) {
      return (
        <MaterialSelect
          label={label}
          error={error}
          options={options}
          className={className}
          forwardedRef={ref}
          {...props}
        />
      )
    }

    // ── Tailwind branch (unchanged) ──────────────────────────────────────
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-gray-900',
            'px-3 py-2 text-sm text-gray-900 dark:text-gray-100',
            'border-gray-300 dark:border-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:ring-red-500',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

// ── Inner component that handles the md-filled-select event bridge ─────────

interface MaterialSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  className?: string
  forwardedRef: React.ForwardedRef<HTMLSelectElement>
}

function MaterialSelect({
  label,
  error,
  options,
  className,
  forwardedRef,
  value,
  defaultValue,
  disabled,
  required,
  name,
  onChange,
  onBlur,
}: MaterialSelectProps) {
  const innerRef = useRef<HTMLElementTagNameMap['md-filled-select'] | null>(null)

  // Merge forwarded ref so callers can access .value
  const setRef = useCallback(
    (el: HTMLElementTagNameMap['md-filled-select'] | null) => {
      innerRef.current = el
      if (typeof forwardedRef === 'function') {
        forwardedRef(el as unknown as HTMLSelectElement)
      } else if (forwardedRef) {
        ;(forwardedRef as React.MutableRefObject<HTMLSelectElement | null>).current =
          el as unknown as HTMLSelectElement
      }
    },
    [forwardedRef],
  )

  // Bridge native 'change' event → React onChange handler
  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const handleChange = (e: Event) => {
      onChange?.(e as unknown as React.ChangeEvent<HTMLSelectElement>)
    }
    const handleBlur = (e: Event) => {
      onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>)
    }

    el.addEventListener('change', handleChange)
    el.addEventListener('blur', handleBlur)
    return () => {
      el.removeEventListener('change', handleChange)
      el.removeEventListener('blur', handleBlur)
    }
  }, [onChange, onBlur])

  // Sync controlled/default value imperatively
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const v = value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : undefined)
    if (v !== undefined && el.value !== v) {
      el.value = v
    }
  }, [value, defaultValue])

  return (
    <md-filled-select
      ref={setRef}
      label={label}
      disabled={disabled || undefined}
      error={!!error || undefined}
      error-text={error}
      required={required || undefined}
      name={name}
      class={className}
    >
      {options.map((opt) => (
        <md-select-option key={opt.value} value={opt.value}>
          {opt.label}
        </md-select-option>
      ))}
    </md-filled-select>
  )
}
