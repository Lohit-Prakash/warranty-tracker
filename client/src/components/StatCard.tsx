import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  colorClass: string
  subtitle?: string
  accent?: 'primary' | 'green' | 'amber' | 'red' | 'gray'
}

export function StatCard({ title, value, icon: Icon, colorClass, subtitle, accent }: StatCardProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 flex items-center gap-4',
      'stat-card',
      accent && `stat-card--${accent}`,
    )}>
      <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0', colorClass)}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}
