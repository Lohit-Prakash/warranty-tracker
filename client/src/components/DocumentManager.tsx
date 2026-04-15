import { useEffect, useState, useRef } from 'react'
import { FileText, Upload, Trash2, Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { productsApi } from '../lib/api'
import type { ProductDocument } from '../types'
import { Button } from './ui/Button'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
]

interface DocumentManagerProps {
  productId: number
}

export function DocumentManager({ productId }: DocumentManagerProps) {
  const [docs, setDocs] = useState<ProductDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    productsApi
      .listDocuments(productId)
      .then((d) => {
        if (mounted) setDocs(d)
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load documents')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [productId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File must be 5MB or smaller')
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG, WebP allowed')
      return
    }

    setUploading(true)
    try {
      const newDoc = await productsApi.uploadDocument(productId, file)
      setDocs((prev) => [newDoc, ...prev])
      toast.success('Document uploaded')
    } catch {
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: ProductDocument) => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return
    setDeletingId(doc.id)
    try {
      await productsApi.deleteDocument(productId, doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (doc: ProductDocument) => {
    try {
      const endpoint = doc.filePath.startsWith('drive:')
        ? `/api/uploads/drive/${doc.filePath.slice(6)}`
        : `/uploads/${doc.filePath.split('/').pop() || ''}`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download document')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Documents</h2>
        <Button size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/jpg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading documents...
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
          No documents uploaded yet
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {doc.fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatSize(doc.fileSize)}</p>
              </div>
              <button
                onClick={() => handleDownload(doc)}
                className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
