import React from 'react'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'
import { useUITheme } from '../../hooks/useUITheme'

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 border-transparent',
  outline: 'bg-transparent text-primary-600 border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:ring-primary-500',
  ghost: 'bg-transparent text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

// Map ButtonVariant to the correct md-* tag name
const mdTagMap: Record<ButtonVariant, string> = {
  default: 'md-filled-button',
  danger:  'md-filled-button',
  outline: 'md-outlined-button',
  ghost:   'md-text-button',
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  onClick,
  type,
  ...rest
}: ButtonProps) {
  const { isMaterial } = useUITheme()

  if (isMaterial) {
    const tag = mdTagMap[variant]
    const dangerClass = variant === 'danger' ? 'md-button--danger' : ''

    // md-* elements use "class" (not "className") — React passes className → class on custom elements
    // React.createElement avoids the JSX dynamic-tag limitation while keeping TypeScript happy
    return React.createElement(
      tag,
      {
        disabled: (disabled || loading) ? true : undefined,
        class: cn(dangerClass, className) || undefined,
        type: type ?? 'button',
        onClick,
        style: size === 'sm' ? { '--md-filled-button-label-text-size': '0.8rem', '--md-outlined-button-label-text-size': '0.8rem', '--md-text-button-label-text-size': '0.8rem' } as React.CSSProperties : undefined,
      },
      loading
        ? React.createElement('md-circular-progress', {
            indeterminate: true,
            slot: 'icon',
            style: { width: 18, height: 18 } as React.CSSProperties,
          })
        : null,
      children,
    )
  }

  return (
    <button
      disabled={disabled || loading}
      type={type}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'transition-all duration-150',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
