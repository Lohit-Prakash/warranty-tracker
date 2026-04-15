import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { claimsApi } from '../lib/api'
import type { WarrantyClaim, ClaimStatus } from '../types'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'

const STATUS_OPTIONS: { value: ClaimStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_COLORS: Record<ClaimStatus, string> = {
  submitted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  denied: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  resolved: 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
}

interface ClaimsPanelProps {
  productId: number
}

export function ClaimsPanel({ productId }: ClaimsPanelProps) {
  const [claims, setClaims] = useState<WarrantyClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [issue, setIssue] = useState('')

  const load = () => {
    setLoading(true)
    claimsApi
      .listForProduct(productId)
      .then(setClaims)
      .catch(() => toast.error('Failed to load claims'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const handleCreate = async () => {
    if (!issue.trim()) {
      toast.error('Issue description is required')
      return
    }
    setSaving(true)
    try {
      const created = await claimsApi.create(productId, claimDate, issue.trim())
      setClaims((prev) => [created, ...prev])
      setShowForm(false)
      setIssue('')
      toast.success('Claim created')
    } catch {
      toast.error('Failed to create claim')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (claim: WarrantyClaim, newStatus: ClaimStatus) => {
    try {
      const updated = await claimsApi.update(claim.id, { status: newStatus })
      setClaims((prev) => prev.map((c) => (c.id === claim.id ? updated : c)))
    } catch {
      toast.error('Failed to update claim')
    }
  }

  const handleDelete = async (claim: WarrantyClaim) => {
    if (!confirm('Delete this claim?')) return
    try {
      await claimsApi.delete(claim.id)
      setClaims((prev) => prev.filter((c) => c.id !== claim.id))
      toast.success('Claim deleted')
    } catch {
      toast.error('Failed to delete claim')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Warranty Claims</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> New Claim
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 p-4 mb-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <Input
            type="date"
            label="Claim Date"
            value={claimDate}
            onChange={(e) => setClaimDate(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Issue Description
            </label>
            <textarea
              rows={3}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="What went wrong?"
              className="w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleCreate}>
              Create Claim
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading claims...
        </div>
      ) : claims.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
          No claims filed yet
        </p>
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {claim.claimDate}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[claim.status]}`}>
                      {STATUS_OPTIONS.find((s) => s.value === claim.status)?.label ?? claim.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {claim.issueDescription}
                  </p>
                  {claim.resolution && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                      Resolution: {claim.resolution}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(claim)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete claim"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2">
                <Select
                  options={STATUS_OPTIONS}
                  value={claim.status}
                  onChange={(e) => handleStatusChange(claim, e.target.value as ClaimStatus)}
                  className="text-xs py-1"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
