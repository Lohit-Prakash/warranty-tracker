import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Pencil, Trash2, ShieldOff } from 'lucide-react'
import type { Product } from '../types'
import { Badge } from './ui/Badge'
import { cn, formatDate, formatDateOrDash, formatDaysRemaining, formatPrice, getStatusBg, getStatusColor, categoryColors, getFileUrl } from '../lib/utils'

interface ProductCardProps {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onClick: (p: Product) => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (p: Product) => void
}

export function ProductCard({ product, onEdit, onDelete, onClick, selectionMode, selected, onToggleSelect }: ProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const hasWarranty = product.status !== 'no_warranty'

  const progressColor = product.status === 'expiring'
    ? 'bg-orange-500'
    : product.status === 'expired'
    ? 'bg-red-500'
    : product.warrantyProgress < 70
    ? 'bg-green-500'
    : product.warrantyProgress < 90
    ? 'bg-amber-500'
    : 'bg-red-500'

  const statusDotColor = product.status === 'active'
    ? 'bg-green-500'
    : product.status === 'expiring'
    ? 'bg-amber-500'
    : product.status === 'no_warranty'
    ? 'bg-gray-400'
    : 'bg-red-500'

  const statusLabel = product.status === 'expiring'
    ? 'Expiring'
    : product.status === 'no_warranty'
    ? 'No warranty'
    : product.status.charAt(0).toUpperCase() + product.status.slice(1)

  return (
    <div
      className={cn(
        'md-product-card',
        'bg-white dark:bg-gray-900 border rounded-xl shadow-sm',
        'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200',
        'cursor-pointer group relative',
        selected
          ? 'border-primary-500 ring-2 ring-primary-500/30'
          : 'border-gray-200 dark:border-gray-800',
      )}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(product)
        } else {
          onClick(product)
        }
      }}
    >
      {selectionMode && (
        <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(product)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        </div>
      )}
      {/* Photo thumbnail */}
      {product.photoPath && (
        <div className="w-full h-36 overflow-hidden rounded-t-xl">
          <img
            src={getFileUrl(product.photoPath) ?? ''}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        {/* Top row: category badge + status + menu */}
        <div className={cn('flex items-center justify-between mb-3', selectionMode && 'pl-6')}>
          <Badge className={categoryColors[product.category]}>
            {product.category}
          </Badge>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotColor)} />
              <span className={cn('text-xs font-medium', getStatusColor(product.status))}>
                {statusLabel}
              </span>
            </div>

            {/* Three-dot menu */}
            <div
              className="relative"
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((o) => !o)
                }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-1 z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onEdit(product)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onDelete(product)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product name + brand */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-snug mb-0.5 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mb-3">
          {product.brand && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{product.brand}</p>
          )}
          {product.price != null && (
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-auto">
              {formatPrice(product.price, product.currency)}
            </p>
          )}
        </div>

        {/* Warranty progress bar — only for products with warranty */}
        {hasWarranty ? (
          <div className="mb-4 mt-1">
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
              <span>Warranty used</span>
              <span>{Math.round(product.warrantyProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', progressColor)}
                style={{ width: `${Math.min(product.warrantyProgress, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-4 mt-1 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <ShieldOff className="h-3.5 w-3.5" />
            <span>No warranty tracked</span>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p className="text-gray-400 dark:text-gray-500 mb-0.5">Purchased</p>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDate(product.purchaseDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 dark:text-gray-500 mb-0.5">{hasWarranty ? 'Expires' : 'Expiry'}</p>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{formatDateOrDash(product.expiryDate)}</p>
          </div>
        </div>

        {/* Time remaining badge */}
        <div className={cn(
          'text-xs font-semibold px-2 py-1 rounded-lg inline-block',
          getStatusBg(product.status),
        )}>
          {formatDaysRemaining(product.daysRemaining)}
        </div>
      </div>
    </div>
  )
}
