import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import { productsApi } from '../lib/api'
import type { ChartsResponse } from '../types'
import { Skeleton } from './ui/Skeleton'

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Expiring: '#f59e0b',
  Expired: '#ef4444',
  'No Warranty': '#9ca3af',
}

export function DashboardCharts() {
  const [data, setData] = useState<ChartsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    productsApi
      .getCharts()
      .then((d) => {
        if (mounted) setData(d)
      })
      .catch(() => {
        // silent fail; charts are non-critical
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    )
  }

  if (!data) return null

  const hasData = data.categoryBreakdown.length > 0

  if (!hasData) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Status Pie */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">By Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.statusBreakdown}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.statusBreakdown.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category Pie */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">By Category</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.categoryBreakdown}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.categoryBreakdown.map((entry, idx) => (
                <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Expiry timeline (full width) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Expirations (Next 12 Months)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.expiryTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="expiring" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
