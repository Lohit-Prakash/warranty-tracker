import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, parseISO, format } from 'date-fns'
import type { ProductCategory, ProductStatus } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy')
}

export function formatDateOrDash(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'MMM d, yyyy')
}

export function getDaysRemaining(expiryDate: string): number {
  return differenceInDays(parseISO(expiryDate), new Date())
}

export function formatPrice(price: number | null | undefined, currency = 'USD'): string {
  if (price == null) return ''
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export const SUPPORTED_CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
]

export function getStatusColor(status: ProductStatus): string {
  switch (status) {
    case 'active': return 'text-green-600 dark:text-green-400'
    case 'expiring': return 'text-amber-600 dark:text-amber-400'
    case 'expired': return 'text-red-600 dark:text-red-400'
    case 'no_warranty': return 'text-gray-500 dark:text-gray-400'
  }
}

export function getStatusBg(status: ProductStatus): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'expiring': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'no_warranty': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}

export const categoryColors: Record<ProductCategory, string> = {
  Electronics: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Appliances: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Vehicles: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Gadgets: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  Home: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  Furniture: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

export function getFileUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('drive:')) return `/api/uploads/drive/${path.slice(6)}`
  return path
}

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return 'No warranty'
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return '1 day remaining'
  if (days < 30) return `${days} days remaining`
  const months = Math.floor(days / 30)
  const remainingDays = days % 30
  if (remainingDays === 0) return `${months} month${months !== 1 ? 's' : ''} remaining`
  return `${months}m ${remainingDays}d remaining`
}
