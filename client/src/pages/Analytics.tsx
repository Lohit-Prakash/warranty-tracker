import { useEffect, useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  ArrowLeft, DollarSign, Package, Shield, TrendingUp,
  CheckCircle, AlertTriangle, XCircle, ShieldOff,
  ReceiptText, ArrowUpRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { productsApi } from '../lib/api'
import type { AnalyticsResponse } from '../types'
import { Navbar } from '../components/Navbar'
import { Skeleton } from '../components/ui/Skeleton'
import { formatPrice, formatDate, categoryColors, SUPPORTED_CURRENCIES } from '../lib/utils'
import { cn } from '../lib/utils'

// ── Palette ─────────────────────────────────────────────────────────────────
const CAT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316', '#6b7280']
const STATUS_HEX: Record<string, string> = {
  Active: '#10b981', Expiring: '#f59e0b', Expired: '#ef4444', 'No Warranty': '#9ca3af',
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtMonth(ym: string) {
  try { return format(parseISO(`${ym}-01`), 'MMM yy') } catch { return ym }
}
function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100)
}
function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? code
  } catch { return code }
}

function shortPrice(v: number, symbol = '$') {
  if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}k`
  return `${symbol}${Math.round(v)}`
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label, formatValue,
}: {
  active?: boolean
  payload?: { value: number; name?: string; color?: string }[]
  label?: string
  formatValue?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 shadow-xl text-sm min-w-[120px]">
      {label && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color ?? '#3b82f6' }}>
          {formatValue ? formatValue(p.value) : p.value}
          {p.name && <span className="text-gray-400 font-normal ml-1 text-xs">{p.name}</span>}
        </p>
      ))}
    </div>
  )
}

// ── Stat hero card ────────────────────────────────────────────────────────────
function HeroStat({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; accent: string
}) {
  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 overflow-hidden group hover:shadow-md transition-shadow">
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity', accent)} style={{ opacity: 0.03 }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</p>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', accent)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Card({ title, subtitle, action, children, className }: {
  title: string; subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6', className)}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 ml-4">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Inline progress bar ───────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Donut center label ─────────────────────────────────────────────────────────
function DonutLabel({ cx, cy, total }: { cx?: number; cy?: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 22, fontWeight: 700 }}>{total}</tspan>
      <tspan x={cx} dy="1.4em" className="fill-gray-400" style={{ fontSize: 11 }}>items</tspan>
    </text>
  )
}

// ── Warranty mini badge ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : status === 'expiring' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : status === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', cls)}>
      {status === 'no_warranty' ? 'No warranty' : status}
    </span>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function Analytics() {
  const { user, loading: authLoading } = useAuth()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const navigate = useNavigate()
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [baseCurrency, setBaseCurrency] = useState('USD')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    productsApi.getAnalytics(baseCurrency)
      .then((d) => { if (mounted) setData(d) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [baseCurrency])

  const sym = currencySymbol(baseCurrency)

  if (!authLoading && !user) return <Navigate to="/login" replace />

  // Chart axis colors — dark mode aware
  const axisColor = isDark ? '#6b7280' : '#9ca3af'
  const gridColor = isDark ? '#1f2937' : '#f3f4f6'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar onSearch={() => {}} searchQuery="" isDark={isDark} onToggleDark={toggleDark} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">All your purchases &amp; warranties at a glance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Display currency</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
            </div>
            <Skeleton variant="card" className="h-72" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton variant="card" className="h-64" />
              <Skeleton variant="card" className="h-64" />
            </div>
          </div>

        /* ── Empty ───────────────────────────────────────────────────── */
        ) : !data || data.summary.totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <ReceiptText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No data yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
              Add products and purchases to start seeing your spending insights.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>

        /* ── Content ─────────────────────────────────────────────────── */
        ) : (
          <div className="space-y-6">

            {/* ── Hero KPIs ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroStat
                label="Total Items"
                value={data.summary.totalItems.toString()}
                sub={`${data.summary.itemsWithWarranty} with warranty · ${data.summary.itemsNoWarranty} without`}
                icon={Package}
                accent="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
              />
              <HeroStat
                label="Total Spent"
                value={data.summary.totalSpent > 0 ? formatPrice(data.summary.totalSpent, baseCurrency) : '—'}
                sub={
                  data.summary.itemsWithPrice < data.summary.totalItems
                    ? `${data.summary.itemsWithPrice} of ${data.summary.totalItems} items priced`
                    : 'all items tracked'
                }
                icon={DollarSign}
                accent="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              />
              <HeroStat
                label="Avg per Item"
                value={data.summary.avgPrice > 0 ? formatPrice(data.summary.avgPrice, baseCurrency) : '—'}
                sub="across priced items"
                icon={TrendingUp}
                accent="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              />
              <HeroStat
                label="Warranty Health"
                value={`${pct(data.summary.activeWarranties, data.summary.itemsWithWarranty)}%`}
                sub={`${data.summary.activeWarranties} active · ${data.summary.expiringWarranties} expiring · ${data.summary.expiredWarranties} expired`}
                icon={Shield}
                accent="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              />
            </div>

            {/* ── Spending over time ────────────────────────────────────── */}
            {data.spendByMonth.length > 0 && (
              <Card
                title="Spending Over Time"
                subtitle={`Monthly spend trend · amounts in ${baseCurrency}`}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={data.spendByMonth.map((r) => ({ ...r, label: fmtMonth(r.month) }))}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke={gridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: axisColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: axisColor }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={(v: number) => shortPrice(v, sym)}
                    />
                    <Tooltip
                      content={<ChartTooltip formatValue={(v) => formatPrice(v, baseCurrency)} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#spendGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Month rows — recent 6 */}
                {data.spendByMonth.some((r) => r.total > 0) && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[...data.spendByMonth].reverse().slice(0, 6).map((row) => (
                      <div key={row.month} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500">{fmtMonth(row.month)}</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                          {row.total > 0 ? formatPrice(row.total, baseCurrency) : '—'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{row.count} item{row.count !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── Yearly summary ────────────────────────────────────────── */}
            {data.spendByYear.length > 1 && (
              <Card title="Year-over-Year" subtitle="Total spend and purchase count per year">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.spendByYear}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="35%"
                    >
                      <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => shortPrice(v, sym)} />
                      <Tooltip content={<ChartTooltip formatValue={(v) => formatPrice(v, baseCurrency)} />} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="flex flex-col justify-center gap-2">
                    {data.spendByYear.map((row, i) => (
                      <div key={row.year} className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 w-10 flex-shrink-0">{row.year}</span>
                        <div className="flex-1">
                          <ProgressBar
                            value={row.total}
                            max={Math.max(...data.spendByYear.map((r) => r.total))}
                            color={CAT_COLORS[i % CAT_COLORS.length]}
                          />
                        </div>
                        <div className="text-right flex-shrink-0 w-28">
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{row.total > 0 ? formatPrice(row.total, baseCurrency) : '—'}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{row.count} items</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* ── Category analysis ─────────────────────────────────────── */}
            {data.spendByCategory.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Donut chart */}
                <Card title="By Category" subtitle="Distribution of items" className="lg:col-span-2">
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={data.categoryBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {data.categoryBreakdown.map((entry, idx) => (
                            <Cell key={entry.name} fill={CAT_COLORS[idx % CAT_COLORS.length]} strokeWidth={0} />
                          ))}
                          <DonutLabel cx={undefined} cy={undefined} total={data.summary.totalItems} />
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} items`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="mt-2 flex flex-wrap gap-2 justify-center">
                    {data.categoryBreakdown.map((entry, idx) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Category spend table */}
                <Card title="Spend by Category" subtitle="Total & average spend per category" className="lg:col-span-3">
                  <div className="space-y-3">
                    {data.spendByCategory.map((row, idx) => {
                      const maxTotal = data.spendByCategory[0]?.total ?? 1
                      return (
                        <div key={row.category}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{row.category}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{row.count} item{row.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              {row.avgPrice > 0 && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">avg {formatPrice(row.avgPrice, baseCurrency)}</span>
                              )}
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-20 text-right">
                                {row.total > 0 ? formatPrice(row.total, baseCurrency) : '—'}
                              </span>
                            </div>
                          </div>
                          <ProgressBar value={row.total} max={maxTotal} color={CAT_COLORS[idx % CAT_COLORS.length]} />
                        </div>
                      )
                    })}

                    {data.summary.totalSpent > 0 && (
                      <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(data.summary.totalSpent, baseCurrency)}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Warranty health ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Status donut */}
              {data.statusBreakdown.length > 0 && (
                <Card title="Warranty Status" subtitle="Current health across all items" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {data.statusBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_HEX[entry.name] ?? '#6b7280'} strokeWidth={0} />
                        ))}
                        <DonutLabel cx={undefined} cy={undefined} total={data.summary.totalItems} />
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} items`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { name: 'Active', value: data.summary.activeWarranties, icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
                      { name: 'Expiring', value: data.summary.expiringWarranties, icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400' },
                      { name: 'Expired', value: data.summary.expiredWarranties, icon: XCircle, color: 'text-red-500 dark:text-red-400' },
                      { name: 'No Warranty', value: data.summary.itemsNoWarranty, icon: ShieldOff, color: 'text-gray-400 dark:text-gray-500' },
                    ].map(({ name, value, icon: Icon, color }) => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{name}</p>
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Expiry timeline */}
              <Card
                title="Upcoming Expirations"
                subtitle="Warranties expiring in the next 12 months"
                className={data.statusBreakdown.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}
              >
                {data.expiryTimeline.every((m) => m.expiring === 0) ? (
                  <div className="flex flex-col items-center justify-center h-44 gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">All clear for the next 12 months</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No warranties expiring soon.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={data.expiryTimeline.map((r) => ({ ...r, label: fmtMonth(r.month) }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<ChartTooltip formatValue={(v) => `${v} item${v !== 1 ? 's' : ''}`} />} />
                      <Bar dataKey="expiring" radius={[5, 5, 0, 0]}>
                        {data.expiryTimeline.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.expiring > 3 ? '#ef4444' : entry.expiring > 1 ? '#f59e0b' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* ── Top purchases ──────────────────────────────────────────── */}
            {data.topPurchases.length > 0 && (
              <Card
                title="Top Purchases"
                subtitle={`Your ${data.topPurchases.length} most expensive items`}
              >
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                        <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</th>
                        <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                        <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Purchased</th>
                        <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Status</th>
                        <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPurchases.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/products/${p.id}`)}
                        >
                          <td className="py-3.5 pr-3">
                            <span className="text-xs font-mono text-gray-300 dark:text-gray-700">{String(idx + 1).padStart(2, '0')}</span>
                          </td>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">{p.name}</p>
                                {p.brand && <p className="text-xs text-gray-400 dark:text-gray-500">{p.brand}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 hidden sm:table-cell">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', categoryColors[p.category as keyof typeof categoryColors] ?? 'bg-gray-100 text-gray-600')}>
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatDate(p.purchaseDate)}
                          </td>
                          <td className="py-3.5 pr-4 hidden lg:table-cell">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                  {p.priceInBase != null ? formatPrice(p.priceInBase, baseCurrency) : '—'}
                                </span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {p.currency !== baseCurrency && p.price != null && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatPrice(p.price, p.currency)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
