import { Link } from 'react-router-dom'
import { Plus, Tag, Bell } from 'lucide-react'
import { Button } from './ui/Button'
import { useUITheme } from '../hooks/useUITheme'
import { cn } from '../lib/utils'
import type { ProductCategory } from '../types'
import { categoryColors } from '../lib/utils'

interface CategoryItem {
  name: string
  count: number
}

interface SidebarProps {
  categories: CategoryItem[]
  activeCategory: string
  onCategoryChange: (cat: string) => void
  onAddProduct: () => void
  totalCount: number
}

const ALL_CATEGORIES: ProductCategory[] = ['Electronics', 'Appliances', 'Vehicles', 'Gadgets', 'Home', 'Furniture', 'Other']

export function Sidebar({ categories, activeCategory, onCategoryChange, onAddProduct, totalCount }: SidebarProps) {
  const { isMaterial } = useUITheme()
  const getCategoryCount = (name: string) => {
    const found = categories.find((c) => c.name === name)
    return found?.count ?? 0
  }

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col gap-4">
      {/* Add Product Button */}
      <Button
        variant="default"
        size="lg"
        className="w-full"
        onClick={onAddProduct}
      >
        <Plus className="h-5 w-5" />
        Add Product
      </Button>

      {/* Categories */}
      <div className={cn(
        'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4',
        isMaterial && 'md-nav-drawer-section',
      )}>
        <div className="flex items-center gap-2 mb-3">
          <Tag className={cn('h-4 w-4', isMaterial ? 'text-gray-400' : 'text-gray-500')} />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Categories</h3>
        </div>
        <ul className="space-y-1">
          {/* All */}
          <li>
            <button
              onClick={() => onCategoryChange('')}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                activeCategory === ''
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <span>All Products</span>
              <span className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                activeCategory === ''
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              )}>
                {totalCount}
              </span>
            </button>
          </li>

          {ALL_CATEGORIES.map((cat) => {
            const count = getCategoryCount(cat)
            const isActive = activeCategory === cat
            return (
              <li key={cat}>
                <button
                  onClick={() => onCategoryChange(cat)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        categoryColors[cat].split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500').replace('-900/30', '-500'),
                      )}
                    />
                    <span>{cat}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
                  )}>
                    {count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Notification Settings */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-300">Notifications</h3>
        </div>
        <p className="text-xs text-primary-600 dark:text-primary-400 mb-3">
          Get notified before your warranties expire. Configure your email alerts in settings.
        </p>
        <Link
          to="/profile"
          className="inline-flex items-center text-xs font-medium text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 underline underline-offset-2"
        >
          Manage notification settings →
        </Link>
      </div>
    </aside>
  )
}
