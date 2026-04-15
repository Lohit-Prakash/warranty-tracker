import { useState } from 'react'
import { Trash2, Tag, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Select } from './ui/Select'

const CATEGORY_OPTIONS = [
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Appliances', label: 'Appliances' },
  { value: 'Vehicles', label: 'Vehicles' },
  { value: 'Gadgets', label: 'Gadgets' },
  { value: 'Home', label: 'Home' },
  { value: 'Furniture', label: 'Furniture' },
  { value: 'Other', label: 'Other' },
]

interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
  onDelete: () => void
  onUpdateCategory: (category: string) => void
}

export function BulkActionBar({ selectedCount, onClear, onDelete, onUpdateCategory }: BulkActionBarProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [category, setCategory] = useState('Electronics')

  const handleApplyCategory = () => {
    onUpdateCategory(category)
    setShowCategoryPicker(false)
  }

  return (
    <div className="sticky top-16 z-30 -mx-4 sm:mx-0 mb-4">
      <div className="md-bulk-bar bg-primary-600 text-white rounded-none sm:rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-primary-700 transition-colors"
          title="Clear selection"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium flex-1 min-w-0">
          {selectedCount} selected
        </span>

        {showCategoryPicker ? (
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <Button size="sm" variant="ghost" className="bg-white/15 text-white hover:bg-white/25 border-transparent" onClick={handleApplyCategory}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCategoryPicker(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost" className="bg-white/15 text-white hover:bg-white/25 border-transparent"
              onClick={() => setShowCategoryPicker(true)}
            >
              <Tag className="h-4 w-4 mr-1" /> Change Category
            </Button>
            <Button
              size="sm"
              variant="ghost" className="bg-white/15 text-white hover:bg-white/25 border-transparent"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
