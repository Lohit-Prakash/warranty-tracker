import { useEffect, useState } from 'react'
import { Share2, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { sharingApi } from '../lib/api'
import type { ProductShare } from '../types'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'

interface SharingPanelProps {
  productId: number
}

export function SharingPanel({ productId }: SharingPanelProps) {
  const [shares, setShares] = useState<ProductShare[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    sharingApi
      .listForProduct(productId)
      .then((d) => {
        if (mounted) setShares(d)
      })
      .catch(() => toast.error('Failed to load shares'))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [productId])

  const handleShare = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    setSaving(true)
    try {
      const created = await sharingApi.share(productId, email, permission)
      setShares((prev) => [created, ...prev])
      setEmail('')
      toast.success('Shared successfully')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error ?? 'Failed to share')
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (share: ProductShare) => {
    if (!confirm(`Revoke access for ${share.sharedWithEmail}?`)) return
    try {
      await sharingApi.revoke(share.id)
      setShares((prev) => prev.filter((s) => s.id !== share.id))
      toast.success('Access revoked')
    } catch {
      toast.error('Failed to revoke access')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sharing</h3>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <Input
            type="email"
            label="Email"
            placeholder="family@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="w-28">
          <Select
            label="Access"
            options={[
              { value: 'view', label: 'View' },
              { value: 'edit', label: 'Edit' },
            ]}
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
          />
        </div>
        <Button size="sm" loading={saving} onClick={handleShare}>
          Share
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : shares.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
          Not shared with anyone yet
        </p>
      ) : (
        <ul className="space-y-2">
          {shares.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                  {s.sharedWithEmail}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {s.permission} access{s.sharedWithUserId ? '' : ' (pending signup)'}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(s)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Revoke access"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
