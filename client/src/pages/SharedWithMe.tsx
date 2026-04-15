import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Users, Package, Shield, ShieldOff, AlertTriangle, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { sharingApi } from '../lib/api'
import type { SharedWithMeItem } from '../types'
import { Navbar } from '../components/Navbar'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { cn, formatDate, formatDateOrDash, formatDaysRemaining, formatPrice, getStatusBg, categoryColors } from '../lib/utils'

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <Shield className="h-4 w-4 text-green-500" />
  if (status === 'expiring') return <AlertTriangle className="h-4 w-4 text-amber-500" />
  if (status === 'expired') return <XCircle className="h-4 w-4 text-red-500" />
  return <ShieldOff className="h-4 w-4 text-gray-400" />
}

function SharedProductCard({ item, onClick }: { item: SharedWithMeItem; onClick: () => void }) {
  const { product } = item
  const hasPhoto = !!product.photoPath

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all cursor-pointer group"
    >
      {/* Photo */}
      {hasPhoto && (
        <div className="w-full h-32 overflow-hidden rounded-t-xl">
          <img src={product.photoPath!} alt={product.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4">
        {/* Category + status */}
        <div className="flex items-center justify-between mb-2">
          <Badge className={categoryColors[product.category as keyof typeof categoryColors] ?? 'bg-gray-100 text-gray-600'}>
            {product.category}
          </Badge>
          <div className="flex items-center gap-1.5">
            <StatusIcon status={product.status} />
            <span className={cn('text-xs font-medium capitalize',
              product.status === 'active' ? 'text-green-600 dark:text-green-400'
              : product.status === 'expiring' ? 'text-amber-600 dark:text-amber-400'
              : product.status === 'expired' ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
            )}>
              {product.status === 'no_warranty' ? 'No warranty' : product.status}
            </span>
          </div>
        </div>

        {/* Name + brand */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug mb-0.5 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mb-3">
          {product.brand && <p className="text-xs text-gray-500 dark:text-gray-400">{product.brand}</p>}
          {product.price != null && (
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-auto">
              {formatPrice(product.price, product.currency)}
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p className="text-gray-400 dark:text-gray-500 mb-0.5">Purchased</p>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(product.purchaseDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 dark:text-gray-500 mb-0.5">Expires</p>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDateOrDash(product.expiryDate)}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={cn('text-xs font-semibold px-2 py-1 rounded-lg inline-block mb-3', getStatusBg(product.status as any))}>
          {formatDaysRemaining(product.daysRemaining)}
        </div>

        {/* Shared by */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                {item.ownerName?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">Shared by {item.ownerName}</p>
            </div>
          </div>
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
            item.permission === 'edit'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          )}>
            {item.permission}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SharedWithMe() {
  const { user, loading: authLoading } = useAuth()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const navigate = useNavigate()
  const [items, setItems] = useState<SharedWithMeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    sharingApi.sharedWithMe()
      .then((data) => { if (mounted) setItems(data) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (!authLoading && !user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar onSearch={() => {}} searchQuery="" isDark={isDark} onToggleDark={toggleDark} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shared with Me</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Products other users have shared with you</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <Skeleton variant="card" count={6} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Nothing shared yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
              When someone shares a product with your email, it will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mb-6">
              {[
                { label: 'Total shared', value: items.length, icon: Package },
                { label: 'Can edit', value: items.filter((i) => i.permission === 'edit').length, icon: Users },
                {
                  label: 'Expiring soon',
                  value: items.filter((i) => i.product.status === 'expiring').length,
                  icon: AlertTriangle,
                },
                {
                  label: 'With warranty',
                  value: items.filter((i) => i.product.status !== 'no_warranty').length,
                  icon: Shield,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5"
                >
                  <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Group by owner */}
            {(() => {
              const owners = Array.from(new Set(items.map((i) => i.ownerEmail)))
              return owners.map((email) => {
                const ownerItems = items.filter((i) => i.ownerEmail === email)
                const ownerName = ownerItems[0]?.ownerName ?? email
                return (
                  <div key={email} className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                          {ownerName[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ownerName}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{email}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                        · {ownerItems.length} item{ownerItems.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {ownerItems.map((item) => (
                        <SharedProductCard
                          key={item.id}
                          item={item}
                          onClick={() => navigate(`/products/${item.productId}`)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
          </>
        )}
      </div>
    </div>
  )
}
