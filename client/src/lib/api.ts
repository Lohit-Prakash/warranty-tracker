import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { User, Product, PaginatedProducts, StatsResponse, NotificationsResponse, ChartsResponse, AnalyticsResponse, ProductDocument, WarrantyClaim, ClaimStatus, ProductShare, SharedWithMeItem, SubscriptionInfo } from '../types'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Auto-refresh access token on 401
let refreshPromise: Promise<void> | null = null

async function performRefresh(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const url = original?.url ?? ''
    // Skip refresh for auth endpoints to avoid infinite loops
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/me')

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        await performRefresh()
        return api.request(original)
      } catch {
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

export default api

// Auth API
export const authApi = {
  register: async (name: string, email: string, password: string): Promise<User> => {
    const res = await api.post<{ data: User }>('/auth/register', { name, email, password })
    return res.data.data
  },
  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ data: User }>('/auth/login', { email, password })
    return res.data.data
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },
  me: async (): Promise<User> => {
    const res = await api.get<{ data: User }>('/auth/me')
    return res.data.data
  },
  forgotPassword: async (email: string): Promise<string> => {
    const res = await api.post<{ data: { message: string } }>('/auth/forgot-password', { email })
    return res.data.data.message
  },
  resetPassword: async (token: string, newPassword: string): Promise<string> => {
    const res = await api.post<{ data: { message: string } }>('/auth/reset-password', { token, newPassword })
    return res.data.data.message
  },
  googleSignIn: (): void => {
    window.location.href = '/api/auth/google'
  },
}

// Products API
export interface ProductsParams {
  search?: string;
  category?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const productsApi = {
  getAll: async (params?: ProductsParams): Promise<PaginatedProducts> => {
    const res = await api.get<{ data: PaginatedProducts }>('/products', { params })
    return res.data.data
  },
  getStats: async (): Promise<StatsResponse> => {
    const res = await api.get<{ data: StatsResponse }>('/products/stats')
    return res.data.data
  },
  getOne: async (id: number): Promise<Product> => {
    const res = await api.get<{ data: Product }>(`/products/${id}`)
    return res.data.data
  },
  create: async (formData: FormData): Promise<Product> => {
    const res = await api.post<{ data: Product }>('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
  update: async (id: number, formData: FormData): Promise<Product> => {
    const res = await api.put<{ data: Product }>(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/products/${id}`)
  },
  export: async (format: 'csv' | 'json', params?: ProductsParams): Promise<Blob> => {
    const res = await api.get('/products/export', {
      params: { ...params, format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  getCharts: async (): Promise<ChartsResponse> => {
    const res = await api.get<{ data: ChartsResponse }>('/products/charts')
    return res.data.data
  },
  getAnalytics: async (baseCurrency = 'USD'): Promise<AnalyticsResponse> => {
    const res = await api.get<{ data: AnalyticsResponse }>('/products/analytics', { params: { baseCurrency } })
    return res.data.data
  },
  bulkDelete: async (ids: number[]): Promise<number> => {
    const res = await api.post<{ data: { deleted: number } }>('/products/bulk-delete', { ids })
    return res.data.data.deleted
  },
  bulkUpdateCategory: async (ids: number[], category: string): Promise<number> => {
    const res = await api.post<{ data: { updated: number } }>('/products/bulk-update-category', { ids, category })
    return res.data.data.updated
  },
  listDocuments: async (productId: number): Promise<ProductDocument[]> => {
    const res = await api.get<{ data: ProductDocument[] }>(`/products/${productId}/documents`)
    return res.data.data
  },
  uploadDocument: async (productId: number, file: File): Promise<ProductDocument> => {
    const fd = new FormData()
    fd.append('document', file)
    const res = await api.post<{ data: ProductDocument }>(`/products/${productId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
  deleteDocument: async (productId: number, docId: number): Promise<void> => {
    await api.delete(`/products/${productId}/documents/${docId}`)
  },
}

// Profile API
export const profileApi = {
  get: async (): Promise<User> => {
    const res = await api.get<{ data: User }>('/profile')
    return res.data.data
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<string> => {
    const res = await api.put<{ data: { message: string } }>('/profile/password', { currentPassword, newPassword })
    return res.data.data.message
  },
  update: async (data: Partial<User>): Promise<User> => {
    // Server expects snake_case for profile fields
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.email !== undefined) payload.email = data.email
    if (data.notificationEmail !== undefined) payload.notification_email = data.notificationEmail
    if (data.notificationsEnabled !== undefined) payload.notifications_enabled = data.notificationsEnabled
    if (data.alertThreshold !== undefined) payload.alert_threshold = data.alertThreshold
    const res = await api.put<{ data: User }>('/profile', payload)
    return res.data.data
  },
}

// Claims API
export const claimsApi = {
  listForProduct: async (productId: number): Promise<WarrantyClaim[]> => {
    const res = await api.get<{ data: WarrantyClaim[] }>(`/claims/product/${productId}`)
    return res.data.data
  },
  create: async (productId: number, claimDate: string, issueDescription: string): Promise<WarrantyClaim> => {
    const res = await api.post<{ data: WarrantyClaim }>('/claims', { productId, claimDate, issueDescription })
    return res.data.data
  },
  update: async (
    id: number,
    updates: {
      claimDate?: string
      issueDescription?: string
      status?: ClaimStatus
      resolution?: string | null
      resolvedDate?: string | null
    },
  ): Promise<WarrantyClaim> => {
    const res = await api.put<{ data: WarrantyClaim }>(`/claims/${id}`, updates)
    return res.data.data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/claims/${id}`)
  },
}

// Sharing API
export const sharingApi = {
  listForProduct: async (productId: number): Promise<ProductShare[]> => {
    const res = await api.get<{ data: ProductShare[] }>(`/sharing/product/${productId}`)
    return res.data.data
  },
  sharedWithMe: async (): Promise<SharedWithMeItem[]> => {
    const res = await api.get<{ data: SharedWithMeItem[] }>('/sharing/shared-with-me')
    return res.data.data
  },
  share: async (productId: number, email: string, permission: 'view' | 'edit' = 'view'): Promise<ProductShare> => {
    const res = await api.post<{ data: ProductShare }>('/sharing', { productId, email, permission })
    return res.data.data
  },
  revoke: async (id: number): Promise<void> => {
    await api.delete(`/sharing/${id}`)
  },
}

// Subscription API
export const subscriptionApi = {
  getStatus: async (): Promise<SubscriptionInfo> => {
    const res = await api.get<{ data: SubscriptionInfo }>('/subscription')
    return res.data.data
  },
  create: async (planId: string): Promise<{ subscriptionId: string; paymentUrl: string }> => {
    const res = await api.post<{ data: { subscriptionId: string; paymentUrl: string } }>(
      '/subscription/create',
      { planId }
    )
    return res.data.data
  },
  cancel: async (atPeriodEnd = true): Promise<void> => {
    await api.post('/subscription/cancel', { atPeriodEnd })
  },
}

// Notifications API
export const notificationsApi = {
  getAll: async (unreadOnly = false): Promise<NotificationsResponse> => {
    const res = await api.get<{ data: NotificationsResponse }>('/notifications', {
      params: unreadOnly ? { unread_only: 'true' } : {},
    })
    return res.data.data
  },
  markRead: async (id: number): Promise<void> => {
    await api.put(`/notifications/${id}/read`)
  },
  markAllRead: async (): Promise<void> => {
    await api.put('/notifications/read-all')
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/notifications/${id}`)
  },
}
