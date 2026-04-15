import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Check, Zap, Star, Building2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { subscriptionApi } from '../lib/api'
import toast from 'react-hot-toast'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

const PLAN_IDS = {
  pro: {
    monthly: import.meta.env.VITE_RAZORPAY_PLAN_ID_PRO_MONTHLY as string,
    yearly: import.meta.env.VITE_RAZORPAY_PLAN_ID_PRO_YEARLY as string,
  },
  business: {
    monthly: import.meta.env.VITE_RAZORPAY_PLAN_ID_BUSINESS_MONTHLY as string,
    yearly: import.meta.env.VITE_RAZORPAY_PLAN_ID_BUSINESS_YEARLY as string,
  },
}

async function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-js')) { resolve(); return }
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    document.body.appendChild(script)
  })
}

interface Tier {
  name: string
  icon: React.ReactNode
  monthlyPrice: number
  yearlyPrice: number
  description: string
  features: string[]
  notIncluded: string[]
  cta: string
  highlight: boolean
  planKey?: 'pro' | 'business'
}

const tiers: Tier[] = [
  {
    name: 'Free',
    icon: <Shield className="h-6 w-6" />,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for getting started with warranty tracking.',
    features: [
      '5 products',
      '1 document per product',
      'Basic dashboard stats',
      'Email expiry alerts',
      'Google login',
    ],
    notIncluded: [
      'Analytics & charts',
      'CSV/JSON export',
      'Google Drive sync',
      'Product sharing',
      'Priority support',
    ],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    icon: <Zap className="h-6 w-6" />,
    monthlyPrice: 24,
    yearlyPrice: 249,
    description: 'For power users who want full visibility and control.',
    features: [
      '100 products',
      '10 documents per product',
      'Full analytics & charts',
      'CSV/JSON export',
      'Google Drive sync',
      'Share with up to 3 people',
      'Up to 50 warranty claims',
      'Custom alert threshold',
      'Priority email support',
    ],
    notIncluded: [],
    cta: 'Subscribe to Pro',
    highlight: true,
    planKey: 'pro',
  },
  {
    name: 'Business',
    icon: <Building2 className="h-6 w-6" />,
    monthlyPrice: 99,
    yearlyPrice: 999,
    description: 'Unlimited everything for teams and heavy users.',
    features: [
      'Unlimited products',
      'Unlimited documents',
      'Full analytics & charts',
      'CSV/JSON export',
      'Google Drive sync',
      'Share with up to 15 people',
      'Unlimited warranty claims',
      'Custom alert threshold',
      'Dedicated support',
    ],
    notIncluded: [],
    cta: 'Subscribe to Business',
    highlight: false,
    planKey: 'business',
  },
]

export function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSubscribe(tier: Tier) {
    if (!tier.planKey) {
      navigate('/register')
      return
    }

    if (!user) {
      navigate(`/login?redirect=/pricing`)
      return
    }

    if (user.subscriptionTier === tier.planKey) {
      toast('You are already on this plan.')
      return
    }

    const planId = PLAN_IDS[tier.planKey][billing]
    if (!planId) {
      toast.error('Plan not configured. Please contact support.')
      return
    }

    setLoading(tier.planKey)
    try {
      await loadRazorpayScript()
      const { subscriptionId } = await subscriptionApi.create(planId)

      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: 'PurchaseVault',
        description: `${tier.name} Plan — ${billing === 'yearly' ? 'Annual' : 'Monthly'}`,
        prefill: { name: user.name, email: user.email },
        theme: { color: '#4f46e5' },
        handler: () => {
          toast.success('Subscription activated! Refreshing your account...')
          setTimeout(() => window.location.reload(), 2500)
        },
      })
      rzp.open()
    } catch {
      toast.error('Failed to start subscription. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const yearlySavingsPercent = Math.round((1 - (249 / (24 * 12))) * 100)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-md shadow-primary-600/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              PurchaseVault
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard" className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md shadow-primary-600/30 transition-all hover:shadow-lg hover:-translate-y-0.5">
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950 mb-6">
            <Star className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300 tracking-wide uppercase">
              Simple, Transparent Pricing
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            All plans include a free trial. Upgrade or cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                billing === 'monthly'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-primary-600'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2',
                billing === 'yearly'
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-primary-600'
              )}
            >
              Yearly
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-black',
                billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              )}>
                Save {yearlySavingsPercent}%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => {
            const price = billing === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice
            const isCurrentPlan = user?.subscriptionTier === (tier.planKey ?? 'free')
            const isLoading = loading === tier.planKey

            return (
              <div
                key={tier.name}
                className={cn(
                  'relative rounded-3xl p-8 flex flex-col border transition-all duration-200',
                  tier.highlight
                    ? 'bg-primary-600 text-white border-primary-600 shadow-2xl shadow-primary-600/30 scale-105'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'
                )}
              >
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full bg-white text-primary-600 text-xs font-black shadow-lg">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-6">
                    <span className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-black shadow-lg',
                      tier.highlight ? 'bg-white text-primary-600' : 'bg-green-500 text-white'
                    )}>
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                  tier.highlight ? 'bg-white/20' : 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
                )}>
                  {tier.icon}
                </div>

                <h2 className={cn('text-2xl font-black mb-1', tier.highlight ? 'text-white' : 'text-gray-900 dark:text-white')}>
                  {tier.name}
                </h2>
                <p className={cn('text-sm mb-6', tier.highlight ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400')}>
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  <span className={cn('text-5xl font-black', tier.highlight ? 'text-white' : 'text-gray-900 dark:text-white')}>
                    {price === 0 ? 'Free' : `₹${price}`}
                  </span>
                  {price > 0 && (
                    <span className={cn('text-sm font-medium ml-1', tier.highlight ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400')}>
                      /{billing === 'yearly' ? 'year' : 'month'}
                    </span>
                  )}
                  {billing === 'yearly' && price > 0 && (
                    <p className={cn('text-xs mt-1', tier.highlight ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500')}>
                      ₹{Math.round(price / 12)}/month billed annually
                    </p>
                  )}
                </div>

                {/* CTA button */}
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={isLoading || isCurrentPlan}
                  className={cn(
                    'w-full py-3.5 rounded-2xl text-sm font-black transition-all mb-8',
                    isCurrentPlan
                      ? 'opacity-50 cursor-not-allowed'
                      : '',
                    tier.highlight
                      ? 'bg-white text-primary-600 hover:bg-primary-50 shadow-lg'
                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/30 hover:-translate-y-0.5'
                  )}
                >
                  {isLoading ? 'Opening payment...' : isCurrentPlan ? 'Current Plan' : tier.cta}
                </button>

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-3">
                      <Check className={cn('h-4 w-4 flex-shrink-0', tier.highlight ? 'text-white' : 'text-primary-500')} />
                      <span className={cn('text-sm', tier.highlight ? 'text-primary-50' : 'text-gray-700 dark:text-gray-300')}>
                        {f}
                      </span>
                    </li>
                  ))}
                  {tier.notIncluded.map((f) => (
                    <li key={f} className="flex items-center gap-3 opacity-40">
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-current" />
                      <span className={cn('text-sm line-through', tier.highlight ? 'text-primary-100' : 'text-gray-500 dark:text-gray-500')}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-gray-400 dark:text-gray-600 mt-12">
          All prices in Indian Rupees (INR). Payments securely processed by Razorpay.
          Subscriptions renew automatically. Cancel anytime from your profile.
        </p>
      </main>
    </div>
  )
}

export default Pricing
