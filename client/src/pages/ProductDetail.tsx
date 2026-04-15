import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, FileText, ExternalLink, Calendar, Tag, ShoppingBag, Hash, Store, StickyNote, DollarSign, ShieldOff } from 'lucide-react'
import { parseISO, differenceInDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { productsApi } from '../lib/api'
import type { Product } from '../types'
import { Navbar } from '../components/Navbar'
import { ProductModal } from '../components/ProductModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { DocumentManager } from '../components/DocumentManager'
import { ClaimsPanel } from '../components/ClaimsPanel'
import { SharingPanel } from '../components/SharingPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { cn, formatDate, formatDateOrDash, formatDaysRemaining, formatPrice, getStatusBg, categoryColors, getFileUrl } from '../lib/utils'

function WarrantyTimeline({ product }: { product: Product }) {
  if (!product.expiryDate) return null

  const purchaseDate = parseISO(product.purchaseDate)
  const expiryDate = parseISO(product.expiryDate)
  const today = new Date()

  const totalDays = differenceInDays(expiryDate, purchaseDate)
  const elapsedDays = differenceInDays(today, purchaseDate)
  const progressPct = totalDays > 0 ? Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100)) : 100

  const todayPct = Math.max(0, Math.min(100, progressPct))

  const barColor = progressPct < 70 ? 'bg-green-500' : progressPct < 90 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Warranty Timeline</h3>
      <div className="relative">
        {/* Today label — above the bar */}
        {todayPct > 0 && todayPct < 100 && (
          <div
            className="absolute bottom-full mb-1 flex flex-col items-center pointer-events-none"
            style={{
              left: `${todayPct}%`,
              transform: todayPct > 80 ? 'translateX(-90%)' : todayPct < 20 ? 'translateX(-10%)' : 'translateX(-50%)',
            }}
          >
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap mb-0.5">Today</span>
            <div className="w-px h-2 bg-gray-400 dark:bg-gray-500" />
          </div>
        )}

        {/* Track */}
        <div className="relative w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-visible">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${progressPct}%` }}
          />
          {/* Today dot on the bar */}
          {todayPct > 0 && todayPct < 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 bg-gray-600 dark:bg-gray-300 shadow"
              style={{ left: `${todayPct}%`, transform: 'translate(-50%, -50%)' }}
            />
          )}
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-2">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Purchase date</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{format(purchaseDate, 'MMM d, yyyy')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-gray-500">Expiry date</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{format(expiryDate, 'MMM d, yyyy')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mt-0.5">
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{value}</p>
      </div>
    </div>
  )
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const navigate = useNavigate()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchProduct = () => {
    if (!id) return
    setLoading(true)
    productsApi.getOne(parseInt(id, 10))
      .then(setProduct)
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProduct()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleteLoading(true)
    try {
      await productsApi.delete(product.id)
      toast.success('Product deleted successfully')
      navigate('/dashboard')
    } catch {
      toast.error('Failed to delete product')
      setDeleteLoading(false)
    }
  }

  const isImage = (path: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(path)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar
        onSearch={() => {}}
        searchQuery=""
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </button>

        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="text" className="h-8 w-64" />
            <Skeleton variant="card" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-gray-500">{error}</div>
        ) : product ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={categoryColors[product.category]}>{product.category}</Badge>
                  <Badge className={getStatusBg(product.status)}>
                    {product.status === 'no_warranty'
                      ? 'No warranty'
                      : product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {product.brand && (
                    <p className="text-gray-500 dark:text-gray-400">{product.brand}</p>
                  )}
                  {product.price != null && (
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {formatPrice(product.price, product.currency)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Product photo — full-width hero when present */}
            {product.photoPath && (
              <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
                <img
                  src={getFileUrl(product.photoPath) ?? ''}
                  alt={product.name}
                  className="w-full max-h-72 object-cover"
                />
              </div>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Product info */}
              <div className="space-y-4">
                {/* Status card */}
                {product.status === 'no_warranty' ? (
                  <div className="rounded-xl p-5 border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <ShieldOff className="h-6 w-6 text-gray-400" />
                      <div>
                        <p className="text-lg font-bold text-gray-600 dark:text-gray-300">No warranty tracked</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This is a general purchase record.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'rounded-xl p-5 border',
                    product.status === 'active'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : product.status === 'expiring'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                  )}>
                    <p className={cn(
                      'text-2xl font-bold',
                      product.status === 'active' ? 'text-green-700 dark:text-green-400'
                        : product.status === 'expiring' ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400',
                    )}>
                      {formatDaysRemaining(product.daysRemaining)}
                    </p>
                    <p className={cn(
                      'text-sm mt-1',
                      product.status === 'active' ? 'text-green-600 dark:text-green-500'
                        : product.status === 'expiring' ? 'text-amber-600 dark:text-amber-500'
                        : 'text-red-600 dark:text-red-500',
                    )}>
                      Expires {formatDate(product.expiryDate!)}
                    </p>
                  </div>
                )}

                {/* Timeline — only when warranty exists */}
                {product.expiryDate && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                    <WarrantyTimeline product={product} />
                  </div>
                )}

                {/* Details */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Product Details</h3>
                  <div>
                    <InfoRow icon={Calendar} label="Purchase Date" value={formatDate(product.purchaseDate)} />
                    {product.expiryDate && (
                      <InfoRow icon={Calendar} label="Expiry Date" value={formatDateOrDash(product.expiryDate)} />
                    )}
                    {product.price != null && (
                      <InfoRow icon={DollarSign} label="Price Paid" value={`${formatPrice(product.price, product.currency)} (${product.currency})`} />
                    )}
                    <InfoRow icon={Tag} label="Category" value={product.category} />
                    <InfoRow icon={Hash} label="Serial Number" value={product.serialNumber} />
                    <InfoRow icon={Store} label="Store / Retailer" value={product.storeName} />
                    <InfoRow icon={ShoppingBag} label="Brand" value={product.brand} />
                    <InfoRow icon={StickyNote} label="Notes" value={product.notes} />
                  </div>
                </div>
              </div>

              {/* Right: Documents & panels */}
              <div className="space-y-4">
                <DocumentManager productId={product.id} />
                <ClaimsPanel productId={product.id} />
                {product.userId === user?.id && <SharingPanel productId={product.id} />}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Receipt / Document</h3>

                  {product.documentPath ? (
                    <div className="space-y-3">
                      {isImage(product.documentPath) ? (
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                          <img
                            src={product.documentPath}
                            alt="Warranty document"
                            className="w-full h-auto max-h-80 object-contain bg-gray-50 dark:bg-gray-800"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                          <FileText className="h-12 w-12 text-gray-400 mb-3" />
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">PDF Document</p>
                          <a
                            href={product.documentPath}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4" />
                              View Document
                            </Button>
                          </a>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <a
                          href={product.documentPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
                      <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No document uploaded</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Edit this product to attach a receipt or document.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {product && (
        <>
          <ProductModal
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            product={product}
            onSuccess={() => {
              setEditOpen(false)
              fetchProduct()
            }}
          />
          <DeleteConfirmDialog
            isOpen={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDelete}
            productName={product.name}
            loading={deleteLoading}
          />
        </>
      )}
    </div>
  )
}
