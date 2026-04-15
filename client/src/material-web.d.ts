/**
 * TypeScript JSX type declarations for @material/web custom elements.
 * Scoped to React's JSX namespace (required for the automatic JSX runtime).
 */

import type React from 'react'

// ── Shared base ────────────────────────────────────────────────────────────
interface MdElementProps extends React.Attributes {
  ref?: React.Ref<HTMLElement>
  class?: string
  style?: React.CSSProperties
  id?: string
  slot?: string
  children?: React.ReactNode
}

// ── Buttons ────────────────────────────────────────────────────────────────
interface MdButtonProps extends MdElementProps {
  disabled?: boolean
  type?: 'submit' | 'reset' | 'button'
  value?: string
  href?: string
  target?: string
  name?: string
  'trailing-icon'?: boolean
  'has-icon'?: boolean
  onClick?: React.MouseEventHandler<HTMLElement>
}

// ── Text field ─────────────────────────────────────────────────────────────
interface MdTextFieldProps extends MdElementProps {
  label?: string
  value?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  error?: boolean
  'error-text'?: string
  'supporting-text'?: string
  required?: boolean
  name?: string
  autocomplete?: string
  'max-length'?: number
  rows?: number
  onInput?: React.FormEventHandler<HTMLElement>
  onChange?: React.ChangeEventHandler<HTMLElement>
  onBlur?: React.FocusEventHandler<HTMLElement>
  onFocus?: React.FocusEventHandler<HTMLElement>
}

// ── Select ─────────────────────────────────────────────────────────────────
interface MdSelectProps extends MdElementProps {
  label?: string
  value?: string
  disabled?: boolean
  error?: boolean
  'error-text'?: string
  'supporting-text'?: string
  required?: boolean
  name?: string
  onChange?: React.ChangeEventHandler<HTMLElement>
  onBlur?: React.FocusEventHandler<HTMLElement>
}

interface MdSelectOptionProps extends MdElementProps {
  value?: string
  selected?: boolean
  disabled?: boolean
}

// ── Dialog ─────────────────────────────────────────────────────────────────
interface MdDialogProps extends MdElementProps {
  open?: boolean
}

// ── Checkbox ───────────────────────────────────────────────────────────────
interface MdCheckboxProps extends MdElementProps {
  checked?: boolean
  disabled?: boolean
  indeterminate?: boolean
  name?: string
  value?: string
  onChange?: React.ChangeEventHandler<HTMLElement>
}

// ── Progress ───────────────────────────────────────────────────────────────
interface MdCircularProgressProps extends MdElementProps {
  value?: number
  indeterminate?: boolean
  'four-color'?: boolean
}

// ── Icon ───────────────────────────────────────────────────────────────────
type MdIconProps = MdElementProps

// ── DOM interface augmentations (for ref access) ───────────────────────────
declare global {
  interface MdFilledTextField extends HTMLElement {
    value: string
    focus(): void
    blur(): void
    reportValidity(): boolean
  }
  interface MdFilledSelect extends HTMLElement {
    value: string
    focus(): void
  }
  interface MdDialog extends HTMLElement {
    open: boolean
    show(): void
    close(returnValue?: string): void
  }
  interface MdCheckboxElement extends HTMLElement {
    checked: boolean
    indeterminate: boolean
  }

  interface HTMLElementTagNameMap {
    'md-filled-button': HTMLElement
    'md-outlined-button': HTMLElement
    'md-text-button': HTMLElement
    'md-filled-text-field': MdFilledTextField
    'md-filled-select': MdFilledSelect
    'md-select-option': HTMLElement
    'md-dialog': MdDialog
    'md-checkbox': MdCheckboxElement
    'md-circular-progress': HTMLElement
    'md-icon': HTMLElement
  }
}

// ── React JSX IntrinsicElements ────────────────────────────────────────────
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MdButtonProps
      'md-outlined-button': MdButtonProps
      'md-text-button': MdButtonProps
      'md-filled-text-field': MdTextFieldProps
      'md-filled-select': MdSelectProps
      'md-select-option': MdSelectOptionProps
      'md-dialog': MdDialogProps
      'md-checkbox': MdCheckboxProps
      'md-circular-progress': MdCircularProgressProps
      'md-icon': MdIconProps
    }
  }
}

export {}
