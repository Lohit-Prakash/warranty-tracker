import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { Product } from '../types'
import { formatDaysRemaining } from '../lib/utils'

interface AlertBannerProps {
  products: Product[]
}

export function AlertBanner({ products }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (products.length === 0 || dismissed) return null

  return (
    <div className="md-banner bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
            {products.length} warrant{products.length !== 1 ? 'ies' : 'y'} expiring soon
          </h3>
          <ul className="space-y-0.5">
            {products.slice(0, 5).map((p) => (
              <li key={p.id} className="text-sm text-amber-700 dark:text-amber-400">
                <span className="font-medium">{p.name}</span>
                {p.brand && ` (${p.brand})`}
                {' — '}
                <span>{formatDaysRemaining(p.daysRemaining)}</span>
              </li>
            ))}
            {products.length > 5 && (
              <li className="text-sm text-amber-600 dark:text-amber-500">
                +{products.length - 5} more...
              </li>
            )}
          </ul>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex-shrink-0 transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
