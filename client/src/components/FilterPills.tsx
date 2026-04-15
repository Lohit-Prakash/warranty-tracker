import { cn } from '../lib/utils'

interface FilterCounts {
  all: number
  active: number
  expiring: number
  expired: number
  noWarranty: number
}

interface FilterPillsProps {
  activeStatus: string
  onChange: (status: string) => void
  counts: FilterCounts
}

const FILTERS = [
  { value: '', label: 'All', key: 'all' as keyof FilterCounts },
  { value: 'active', label: 'Active', key: 'active' as keyof FilterCounts },
  { value: 'expiring', label: 'Expiring Soon', key: 'expiring' as keyof FilterCounts },
  { value: 'expired', label: 'Expired', key: 'expired' as keyof FilterCounts },
  { value: 'no_warranty', label: 'No warranty', key: 'noWarranty' as keyof FilterCounts },
]

export function FilterPills({ activeStatus, onChange, counts }: FilterPillsProps) {
  return (
    <div className="md-filter-chips flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = activeStatus === f.value
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
              isActive
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400',
            )}
          >
            {f.label}
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-semibold',
              isActive
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            )}>
              {counts[f.key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
