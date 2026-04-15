import React, { useCallback, useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'
import { useUITheme } from '../../hooks/useUITheme'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const { isMaterial } = useUITheme()
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    // ── Material Web branch ──────────────────────────────────────────────
    if (isMaterial) {
      return (
        <MaterialInput
          label={label}
          error={error}
          helperText={helperText}
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
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-gray-900',
            'px-3 py-2 text-sm text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'border-gray-300 dark:border-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            props.type === 'date' || props.type === 'datetime-local'
              ? '[color-scheme:light] dark:[color-scheme:dark]'
              : '',
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

// ── Inner component that handles the md-filled-text-field event bridge ────

interface MaterialInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  className?: string
  forwardedRef: React.ForwardedRef<HTMLInputElement>
}

function MaterialInput({
  label,
  error,
  helperText,
  className,
  forwardedRef,
  type,
  placeholder,
  disabled,
  required,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  // Intentionally not forwarded: id, autoComplete handled below
  ...rest
}: MaterialInputProps) {
  const innerRef = useRef<HTMLElementTagNameMap['md-filled-text-field'] | null>(null)

  // Merge the forwarded ref with our local ref so react-hook-form can
  // access .value on the element (it reads element.value directly).
  const setRef = useCallback(
    (el: HTMLElementTagNameMap['md-filled-text-field'] | null) => {
      innerRef.current = el
      // react-hook-form passes a RefCallback typed as HTMLInputElement.
      // md-filled-text-field exposes .value so this cast is safe at runtime.
      if (typeof forwardedRef === 'function') {
        forwardedRef(el as unknown as HTMLInputElement)
      } else if (forwardedRef) {
        ;(forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current =
          el as unknown as HTMLInputElement
      }
    },
    [forwardedRef],
  )

  // Bridge native DOM events → React synthetic event handlers.
  // react-hook-form's register() passes onChange/onBlur that expect to be
  // called with an event-like object. The native InputEvent satisfies this.
  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const handleInput = (e: Event) => {
      onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>)
    }
    const handleBlur = (e: Event) => {
      onBlur?.(e as unknown as React.FocusEvent<HTMLInputElement>)
    }
    const handleFocus = (e: Event) => {
      onFocus?.(e as unknown as React.FocusEvent<HTMLInputElement>)
    }

    el.addEventListener('input', handleInput)
    el.addEventListener('blur', handleBlur)
    el.addEventListener('focus', handleFocus)
    return () => {
      el.removeEventListener('input', handleInput)
      el.removeEventListener('blur', handleBlur)
      el.removeEventListener('focus', handleFocus)
    }
  }, [onChange, onBlur, onFocus])

  // Sync controlled value imperatively (md-filled-text-field does not
  // respond to the "value" attribute after initial render like a native input).
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const v = value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : undefined)
    if (v !== undefined && el.value !== v) {
      el.value = v
    }
  }, [value, defaultValue])

  // Suppress unused spread remainder — rest contains attributes like
  // autoComplete, min, max which md-filled-text-field does not use.
  void rest

  return (
    <md-filled-text-field
      ref={setRef}
      label={label}
      type={type as string | undefined}
      placeholder={placeholder}
      disabled={disabled || undefined}
      error={!!error || undefined}
      error-text={error}
      supporting-text={helperText && !error ? helperText : undefined}
      required={required || undefined}
      name={name}
      class={className}
    />
  )
}
