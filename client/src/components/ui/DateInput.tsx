import React from 'react'
import { format, subDays } from 'date-fns'
import { cn } from '../../lib/utils'

interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  onValueChange?: (value: string) => void
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, className, onValueChange, onChange, ...props }, ref) => {
    const inputId = label?.toLowerCase().replace(/\s+/g, '-')

    const setQuick = (daysAgo: number) => {
      const val = format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
      onValueChange?.(val)
      // Also fire a synthetic change event for react-hook-form compatibility
      const nativeInput = (ref as React.RefObject<HTMLInputElement>)?.current
      if (nativeInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeInputValueSetter?.call(nativeInput, val)
        nativeInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }

    const quickButtons = [
      { label: 'Today', days: 0 },
      { label: 'Yesterday', days: 1 },
    ]

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
          type="date"
          onChange={onChange}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-gray-900',
            'px-3 py-2 text-sm text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'border-gray-300 dark:border-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            '[color-scheme:light] dark:[color-scheme:dark]',
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
            className,
          )}
          {...props}
        />
        <div className="flex items-center gap-1 mt-0.5">
          {quickButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => setQuick(btn.days)}
              className={cn(
                'text-xs px-2 py-0.5 rounded-md font-medium transition-colors',
                'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                'hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400',
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

DateInput.displayName = 'DateInput'
