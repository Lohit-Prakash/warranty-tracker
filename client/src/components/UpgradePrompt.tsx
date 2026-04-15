import { X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { QuotaError } from '../types'

const FEATURE_LABELS: Record<string, string> = {
  products: 'products',
  documents: 'documents per product',
  sharing: 'product sharing',
  claims: 'warranty claims',
  analyticsEnabled: 'analytics & charts',
  exportEnabled: 'CSV/JSON export',
  driveEnabled: 'Google Drive sync',
}

const TIER_NAMES: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
}

interface UpgradePromptProps {
  quota: QuotaError
  onClose: () => void
}

export function UpgradePrompt({ quota, onClose }: UpgradePromptProps) {
  const featureLabel = FEATURE_LABELS[quota.feature] ?? quota.feature
  const tierName = TIER_NAMES[quota.tier] ?? quota.tier
  const isBoolean = quota.limit === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950 flex items-center justify-center mb-6">
          <Zap className="h-7 w-7 text-primary-600 dark:text-primary-400" />
        </div>

        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Upgrade to Continue
        </h2>

        <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {isBoolean ? (
            <>
              <strong className="text-gray-700 dark:text-gray-200">{featureLabel}</strong> is not
              available on the <strong className="text-gray-700 dark:text-gray-200">{tierName}</strong> plan.
            </>
          ) : (
            <>
              You've reached the{' '}
              <strong className="text-gray-700 dark:text-gray-200">
                {quota.limit} {featureLabel}
              </strong>{' '}
              limit on the{' '}
              <strong className="text-gray-700 dark:text-gray-200">{tierName}</strong> plan.
            </>
          )}{' '}
          Upgrade to unlock more.
        </p>

        <div className="flex gap-3">
          <Link
            to="/pricing"
            className="flex-1 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold text-center shadow-md shadow-primary-600/30 transition-all hover:-translate-y-0.5"
            onClick={onClose}
          >
            View Plans
          </Link>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpgradePrompt
