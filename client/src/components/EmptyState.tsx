import { Button } from './ui/Button'
import { Plus } from 'lucide-react'

interface EmptyStateProps {
  onAddProduct: () => void
  filtered?: boolean
}

export function EmptyState({ onAddProduct, filtered = false }: EmptyStateProps) {
  return (
    <div className="md-empty-state flex flex-col items-center justify-center py-20 text-center">
      {/* Shield SVG illustration */}
      <svg
        width="120"
        height="130"
        viewBox="0 0 120 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-6"
      >
        {/* Shield body */}
        <path
          d="M60 8L16 24V60C16 85.4 35.6 109.2 60 116C84.4 109.2 104 85.4 104 60V24L60 8Z"
          fill="#e4e1fd"
          stroke="#aba2f7"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Inner shield highlight */}
        <path
          d="M60 18L26 31V60C26 80.8 41.4 100.4 60 106.4C78.6 100.4 94 80.8 94 60V31L60 18Z"
          fill="#ccc7fb"
          opacity="0.5"
        />
        {/* Checkmark */}
        <path
          d="M42 63L54 75L78 51"
          stroke="#534AB7"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {filtered ? (
        <>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No warranties found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            No products match your current filters. Try adjusting the filters or adding a new product.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No warranties yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Start by adding your first product warranty to keep track of expiry dates and documents.
          </p>
        </>
      )}

      <Button onClick={onAddProduct} size="lg">
        <Plus className="h-5 w-5" />
        Add Product
      </Button>
    </div>
  )
}
