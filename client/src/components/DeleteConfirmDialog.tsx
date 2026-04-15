import { AlertTriangle } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  productName: string
  loading: boolean
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  productName,
  loading,
}: DeleteConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Product" className="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Delete "{productName}"?
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          All warranty data and uploaded documents for this product will be permanently deleted.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
