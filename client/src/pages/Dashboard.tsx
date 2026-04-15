import { useState, useCallback, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Package, CheckCircle, AlertTriangle, XCircle, ShieldOff, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { useProducts, useStats } from '../hooks/useProducts'
import { useDebounce } from '../hooks/useDebounce'
import { productsApi } from '../lib/api'
import type { Product, SortOption, ProductCategory } from '../types'

import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'
import { StatCard } from '../components/StatCard'
import { AlertBanner } from '../components/AlertBanner'
import { ProductCard } from '../components/ProductCard'
import { ProductModal } from '../components/ProductModal'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { FilterPills } from '../components/FilterPills'
import { SortDropdown } from '../components/SortDropdown'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { ExportDropdown } from '../components/ExportDropdown'
import { BulkActionBar } from '../components/BulkActionBar'
import { Skeleton } from '../components/ui/Skeleton'

export function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('expiring_soonest')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // Fetch stats (unfiltered) for cards and sidebar
  const { stats, categories: categoryMap, refetch: refetchStats } = useStats()

  // Fetch filtered + paginated products for display
  const { products, pagination, loading } = useProducts(
    useMemo(() => ({
      search: debouncedSearch || undefined,
      category: activeCategory || undefined,
      status: activeStatus || undefined,
      sort: sortBy,
      page,
      limit: 12,
    }), [debouncedSearch, activeCategory, activeStatus, sortBy, page])
  )

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  // Build category counts for sidebar
  const categoryCounts = Object.entries(categoryMap).map(([name, count]) => ({ name, count }))

  // Reset page when filters change
  const handleStatusChange = (status: string) => {
    setActiveStatus(status)
    setPage(1)
  }
  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat as ProductCategory | '')
    setPage(1)
  }
  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort)
    setPage(1)
  }
  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(1)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteProduct) return
    setDeleteLoading(true)
    try {
      await productsApi.delete(deleteProduct.id)
      setDeleteProduct(null)
      refetchStats()
      toast.success('Product deleted successfully')
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSuccess = useCallback(() => {
    refetchStats()
    setEditProduct(null)
    toast.success('Product saved successfully')
  }, [refetchStats])

  const isFiltered = !!(search || activeStatus || activeCategory)

  const toggleSelect = (p: Product) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    try {
      const deleted = await productsApi.bulkDelete(Array.from(selectedIds))
      toast.success(`${deleted} product${deleted === 1 ? '' : 's'} deleted`)
      clearSelection()
      setBulkConfirmOpen(false)
      refetchStats()
    } catch {
      toast.error('Failed to delete products')
    }
  }

  const handleBulkUpdateCategory = async (category: string) => {
    if (selectedIds.size === 0) return
    try {
      const updated = await productsApi.bulkUpdateCategory(Array.from(selectedIds), category)
      toast.success(`${updated} product${updated === 1 ? '' : 's'} updated`)
      clearSelection()
      refetchStats()
    } catch {
      toast.error('Failed to update products')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar
        onSearch={handleSearch}
        searchQuery={search}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8">
          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* Alert Banner */}
            {stats.expiring > 0 && (
              <AlertBanner products={products.filter((p) => p.status === 'expiring')} />
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total"
                value={stats.total}
                icon={Package}
                colorClass="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                accent="primary"
              />
              <StatCard
                title="Active"
                value={stats.active}
                icon={CheckCircle}
                colorClass="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                accent="green"
              />
              <StatCard
                title="Expiring"
                value={stats.expiring}
                icon={AlertTriangle}
                colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                subtitle={`within ${user?.alertThreshold ?? 30} days`}
                accent="amber"
              />
              <StatCard
                title="Expired"
                value={stats.expired}
                icon={XCircle}
                colorClass="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                accent="red"
              />
              <StatCard
                title="No warranty"
                value={stats.noWarranty}
                icon={ShieldOff}
                colorClass="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                accent="gray"
              />
            </div>

            {/* Filters + Sort */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterPills
                activeStatus={activeStatus}
                onChange={handleStatusChange}
                counts={{
                  all: stats.total,
                  active: stats.active,
                  expiring: stats.expiring,
                  expired: stats.expired,
                  noWarranty: stats.noWarranty,
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectionMode((v) => !v)
                    if (selectionMode) setSelectedIds(new Set())
                  }}
                  className={`p-2 rounded-lg border transition-colors ${
                    selectionMode
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 text-primary-600'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title="Toggle selection mode"
                >
                  <CheckSquare className="h-4 w-4" />
                </button>
                <SortDropdown value={sortBy} onChange={handleSortChange} />
                <ExportDropdown />
              </div>
            </div>

            {/* Bulk action bar */}
            {selectionMode && selectedIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedIds.size}
                onClear={clearSelection}
                onDelete={() => setBulkConfirmOpen(true)}
                onUpdateCategory={handleBulkUpdateCategory}
              />
            )}

            {/* Product grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <Skeleton variant="card" count={6} />
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                onAddProduct={() => setShowAddModal(true)}
                filtered={isFiltered}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onEdit={(prod) => setEditProduct(prod)}
                      onDelete={(prod) => setDeleteProduct(prod)}
                      onClick={(prod) => navigate(`/products/${prod.id}`)}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(p.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                />
              </>
            )}
          </main>

          {/* Sidebar (desktop) */}
          <div className="hidden lg:block flex-shrink-0">
            <Sidebar
              categories={categoryCounts}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              onAddProduct={() => setShowAddModal(true)}
              totalCount={stats.total}
            />
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <ProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleSuccess}
      />

      {/* Edit Product Modal */}
      {editProduct && (
        <ProductModal
          isOpen={!!editProduct}
          onClose={() => setEditProduct(null)}
          product={editProduct}
          onSuccess={handleSuccess}
        />
      )}

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDeleteConfirm}
        productName={deleteProduct?.name ?? ''}
        loading={deleteLoading}
      />

      {/* Bulk Delete Confirm */}
      <DeleteConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        productName={`${selectedIds.size} product${selectedIds.size === 1 ? '' : 's'}`}
        loading={false}
      />
    </div>
  )
}
