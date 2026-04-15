import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUITheme } from '../../hooks/useUITheme'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const { isMaterial } = useUITheme()

  if (isMaterial) {
    return (
      <MaterialModal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        className={className}
      >
        {children}
      </MaterialModal>
    )
  }

  // ── Tailwind branch (unchanged) ──────────────────────────────────────────
  return <TailwindModal isOpen={isOpen} onClose={onClose} title={title} className={className}>{children}</TailwindModal>
}

// ── Material Web modal using md-dialog ────────────────────────────────────
//
// IMPORTANT: md-dialog must ALWAYS be mounted (never unmounted on isOpen=false)
// because removing it from the DOM aborts the close animation and breaks
// the next open cycle. We drive open/close via .show()/.close() methods only.

function MaterialModal({ isOpen, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLElementTagNameMap['md-dialog'] | null>(null)

  // Drive open/close imperatively
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (isOpen) {
      el.show()
    } else {
      el.close()
    }
  }, [isOpen])

  // Wire events after mount (only once)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    // 'closed' fires after the close animation completes
    const handleClosed = () => {
      onClose()
    }

    // 'cancel' fires when the user presses Escape
    const handleCancel = (e: Event) => {
      e.preventDefault() // prevent md-dialog's default behavior of removing from DOM
      onClose()
    }

    el.addEventListener('closed', handleClosed)
    el.addEventListener('cancel', handleCancel)
    return () => {
      el.removeEventListener('closed', handleClosed)
      el.removeEventListener('cancel', handleCancel)
    }
    // onClose intentionally excluded — we only attach once and re-close
    // is driven by the isOpen effect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <md-dialog
      ref={dialogRef}
      class={className}
      style={{ minWidth: 'min(560px, 90vw)', maxHeight: '90vh' } as React.CSSProperties}
    >
      {/* Headline slot: title + close button */}
      <div
        slot="headline"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        <button
          onClick={() => dialogRef.current?.close()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--md-sys-color-on-surface-variant)',
            borderRadius: '50%',
          }}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content slot: scrollable body */}
      <div
        slot="content"
        style={{ overflowY: 'auto', maxHeight: '65vh' }}
      >
        {children}
      </div>
    </md-dialog>
  )
}

// ── Tailwind modal (original implementation, unchanged) ────────────────────

function TailwindModal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl',
          'bg-white dark:bg-gray-900',
          'border border-gray-200 dark:border-gray-800',
          'shadow-2xl',
          'max-h-[90vh] flex flex-col',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
