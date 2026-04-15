export type SubscriptionTier = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface User {
  id: number;
  name: string;
  email: string;
  notificationEmail: string | null;
  notificationsEnabled: boolean;
  alertThreshold: number;
  googleId?: string | null;
  createdAt: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPeriodEnd: string | null;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  razorpaySubscriptionId: string | null;
}

export interface QuotaError {
  error: 'quota_exceeded';
  feature: string;
  limit: number;
  current: number;
  tier: string;
  upgradeUrl: string;
}

export interface AppNotification {
  id: number;
  productId: number | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export type ProductCategory = 'Electronics' | 'Appliances' | 'Vehicles' | 'Gadgets' | 'Home' | 'Furniture' | 'Other';
export type ProductStatus = 'active' | 'expiring' | 'expired' | 'no_warranty';
export type SortOption = 'expiring_soonest' | 'recently_added' | 'alphabetical';

export interface Product {
  id: number;
  userId: number;
  name: string;
  brand: string | null;
  category: ProductCategory;
  purchaseDate: string;
  expiryDate: string | null;
  serialNumber: string | null;
  storeName: string | null;
  notes: string | null;
  documentPath: string | null;
  price: number | null;
  currency: string;
  photoPath: string | null;
  createdAt: string;
  updatedAt: string;
  // computed fields from server
  daysRemaining: number | null;
  status: ProductStatus;
  warrantyProgress: number;
}

export interface ProductFormData {
  name: string;
  brand: string;
  category: ProductCategory;
  purchase_date: string;
  expiry_date?: string;
  serial_number: string;
  store_name: string;
  notes: string;
  price?: string;
  currency?: string;
}

export interface SharedWithMeItem {
  id: number;
  productId: number;
  ownerId: number;
  sharedWithEmail: string;
  sharedWithUserId: number | null;
  permission: 'view' | 'edit';
  createdAt: string;
  productName?: string;
  ownerName: string;
  ownerEmail: string;
  product: Product;
}

export interface DashboardStats {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  noWarranty: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedProducts {
  products: Product[];
  pagination: PaginationInfo;
}

export interface StatsResponse {
  stats: DashboardStats;
  categories: Record<string, number>;
}

export interface ProductDocument {
  id: number;
  productId: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  createdAt: string;
}

export interface ChartsResponse {
  categoryBreakdown: { name: string; value: number }[];
  statusBreakdown: { name: string; value: number }[];
  expiryTimeline: { month: string; expiring: number }[];
}

export interface AnalyticsSummary {
  totalItems: number;
  totalSpent: number;
  avgPrice: number;
  itemsWithPrice: number;
  itemsWithWarranty: number;
  itemsNoWarranty: number;
  activeWarranties: number;
  expiringWarranties: number;
  expiredWarranties: number;
}

export interface AnalyticsResponse {
  baseCurrency: string;
  summary: AnalyticsSummary;
  spendByYear: { year: string; total: number; count: number }[];
  spendByMonth: { month: string; total: number; count: number }[];
  spendByCategory: { category: string; total: number; count: number; avgPrice: number }[];
  topPurchases: {
    id: number;
    name: string;
    brand: string | null;
    category: string;
    price: number | null;
    currency: string;
    priceInBase: number | null;
    purchaseDate: string;
    status: string;
  }[];
  categoryBreakdown: { name: string; value: number }[];
  statusBreakdown: { name: string; value: number }[];
  expiryTimeline: { month: string; expiring: number }[];
}

export type ClaimStatus = 'submitted' | 'in_progress' | 'approved' | 'denied' | 'resolved';

export interface WarrantyClaim {
  id: number;
  productId: number;
  userId: number;
  claimDate: string;
  issueDescription: string;
  status: ClaimStatus;
  resolution: string | null;
  resolvedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductShare {
  id: number;
  productId: number;
  ownerId: number;
  sharedWithEmail: string;
  sharedWithUserId: number | null;
  permission: 'view' | 'edit';
  createdAt: string;
  productName?: string;
}
