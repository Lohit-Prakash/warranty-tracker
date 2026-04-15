import { useState, useEffect, useCallback } from 'react'
import { productsApi, ProductsParams } from '../lib/api'
import type { Product, PaginationInfo, DashboardStats, StatsResponse } from '../types'

export function useProducts(params?: ProductsParams) {
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 12, total: 0, totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    productsApi.getAll(params)
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products)
          setPagination(data.pagination)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.error ?? 'Failed to load products')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, params?.search, params?.category, params?.status, params?.sort, params?.page, params?.limit])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { products, pagination, loading, error, refetch }
}

export function useStats() {
  const [stats, setStats] = useState<DashboardStats>({ total: 0, active: 0, expiring: 0, expired: 0, noWarranty: 0 })
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    productsApi.getStats()
      .then((data: StatsResponse) => {
        if (!cancelled) {
          setStats(data.stats)
          setCategories(data.categories)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { stats, categories, loading, refetch }
}
