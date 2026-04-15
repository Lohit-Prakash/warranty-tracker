import { ArrowUpDown } from 'lucide-react'
import type { SortOption } from '../types'
import { cn } from '../lib/utils'

interface SortDropdownProps {
  value: SortOption
  onChange: (v: SortOption) => void
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'expiring_soonest', label: 'Expiring Soonest' },
  { value: 'recently_added', label: 'Recently Added' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className={cn(
          'rounded-lg border bg-white dark:bg-gray-900',
          'px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300',
          'border-gray-300 dark:border-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
        )}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
