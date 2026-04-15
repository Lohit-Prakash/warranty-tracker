import { Link } from 'react-router-dom'
import {
  Shield,
  Bell,
  FileText,
  Wrench,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'

// ── Navbar ──────────────────────────────────────────────────────────────────
function LandingNav() {
  return (
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
          <Link
            to="/pricing"
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Pricing
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md shadow-primary-600/30 transition-all hover:shadow-lg hover:shadow-primary-600/40 hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white dark:bg-gray-950 pt-20 pb-24 sm:pt-28 sm:pb-32">
      {/* Background blobs */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary-100 dark:bg-primary-950 opacity-50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-50 dark:bg-primary-950/50 opacity-60 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950 mb-8">
            <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300 tracking-wide uppercase">
              Never Lose a Warranty Again
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black leading-none tracking-tight text-gray-900 dark:text-white mb-6">
            All Your
            <br />
            <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              Warranties.
            </span>
            <br />
            One Place.
          </h1>

          {/* Sub-headline */}
          <p className="text-xl sm:text-2xl text-gray-500 dark:text-gray-400 font-medium max-w-2xl mb-10 leading-relaxed">
            Track every product, get expiry alerts before it's too late,
            manage claims, and store documents — all in one powerful vault.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-lg font-bold shadow-xl shadow-primary-600/30 transition-all hover:shadow-2xl hover:shadow-primary-600/40 hover:-translate-y-1"
            >
              Create Free Account
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-lg font-bold hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
            >
              Sign In
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Proof points */}
          <div className="flex flex-wrap gap-6 mt-10">
            {[
              'Free to use',
              'Secure & private',
              'Email alerts',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                <span className="text-base font-semibold text-gray-600 dark:text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative dashboard preview card */}
        <div className="mt-20 relative">
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-white dark:to-gray-950 z-10 pointer-events-none" />
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-2xl overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 flex-1 h-6 rounded-md bg-gray-100 dark:bg-gray-800 max-w-xs" />
            </div>

            {/* Mock stat cards */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Products', value: '24', color: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' },
                { label: 'Active', value: '18', color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
                { label: 'Expiring Soon', value: '4', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
                { label: 'Expired', value: '2', color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
              ].map((card) => (
                <div key={card.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{card.label}</p>
                  <p className={cn('text-3xl font-black', card.color.split(' ').slice(2).join(' '))}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Mock product rows */}
            <div className="px-6 pb-6 space-y-3">
              {[
                { name: 'Samsung 65" TV', cat: 'Electronics', status: 'Active', days: '428 days left', dot: 'bg-green-500' },
                { name: 'LG Refrigerator', cat: 'Appliances', status: 'Expiring Soon', days: '14 days left', dot: 'bg-amber-500' },
                { name: 'Sony Headphones', cat: 'Electronics', status: 'Active', days: '201 days left', dot: 'bg-green-500' },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', p.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.cat}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">{p.days}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: '100%', label: 'Free Forever' },
    { value: '∞', label: 'Products Tracked' },
    { value: '0', label: 'Missed Expiries' },
  ]

  return (
    <section className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 text-center divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700">
          {stats.map((s) => (
            <div key={s.label} className="py-6 sm:py-0 sm:px-8">
              <p className="text-5xl sm:text-6xl font-black text-primary-600 dark:text-primary-400 mb-2 tracking-tight">
                {s.value}
              </p>
              <p className="text-base font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Features Grid ────────────────────────────────────────────────────────────
const features = [
  {
    icon: Shield,
    title: 'Warranty Tracking',
    description:
      "Log every product with purchase date, expiry, category, and serial number. Never wonder if something's still under warranty.",
    accent: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
  },
  {
    icon: Bell,
    title: 'Expiry Alerts',
    description:
      'Get daily email notifications before warranties expire — 30 days out, 14 days, even the day before. Fully configurable.',
    accent: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  },
  {
    icon: FileText,
    title: 'Document Storage',
    description:
      'Upload receipts, invoices, and warranty cards. OCR auto-fills product details from scanned images. Everything in one place.',
    accent: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  },
  {
    icon: Wrench,
    title: 'Claims Management',
    description:
      'Track warranty claims from submission to resolution. Follow every stage: submitted → in progress → approved → resolved.',
    accent: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  },
  {
    icon: Users,
    title: 'Product Sharing',
    description:
      'Share warranties with family members or colleagues. Grant view or edit access by email. Perfect for shared household items.',
    accent: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Visualize your warranty portfolio by category, status, and timeline. Export to CSV or JSON for your own records.',
    accent: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  },
]

function FeaturesGrid() {
  return (
    <section className="py-24 sm:py-32 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-4">
            Everything You Need
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
            Built for real warranty management.
          </h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 font-medium">
            Not just a spreadsheet. A complete system for tracking, alerting, claiming, and documenting every warranty you own.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group relative p-8 rounded-3xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Left accent bar on hover */}
                <div className={cn('absolute left-0 top-6 bottom-6 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-300', f.accent.split(' ')[0])} />
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6', f.accent)}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{f.title}</h3>
                <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">{f.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── How It Works ─────────────────────────────────────────────────────────────
const steps = [
  {
    num: '01',
    title: 'Add Your Products',
    description:
      'Enter product details manually or scan your receipt with OCR to auto-fill everything in seconds.',
  },
  {
    num: '02',
    title: 'Upload Your Documents',
    description:
      "Attach receipts, invoices, and warranty cards so they're always accessible when you need them.",
  },
  {
    num: '03',
    title: 'Relax — We Alert You',
    description:
      'Receive email reminders before warranties expire. Never scramble to find proof of purchase again.',
  },
]

function HowItWorks() {
  return (
    <section className="py-24 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
            Up and running in minutes.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              <div className="flex flex-col items-start">
                {/* Number circle + connector line */}
                <div className="relative w-20 h-20 rounded-3xl bg-primary-600 flex items-center justify-center mb-8 shadow-xl shadow-primary-600/30 flex-shrink-0">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 w-[calc(100%+2rem)] h-0.5 bg-gradient-to-r from-primary-300 to-primary-100 dark:from-primary-700 dark:to-primary-900 ml-2" />
                  )}
                  <span className="text-2xl font-black text-white">{step.num}</span>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">{step.title}</h3>
                <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ───────────────────────────────────────────────────────────────
function CtaBanner() {
  return (
    <section className="py-24 sm:py-32 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-600 to-primary-500 p-12 sm:p-20 text-center shadow-2xl shadow-primary-600/30">
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/10 pointer-events-none" />

          <div className="relative">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6">
              Stop losing warranties.
              <br />
              Start using PurchaseVault.
            </h2>
            <p className="text-xl text-primary-100 font-medium mb-10 max-w-xl mx-auto">
              Create your free account and add your first product in under 2 minutes.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-white text-primary-600 text-xl font-black shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200"
            >
              Create Free Account
              <ArrowRight className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 py-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-black text-gray-900 dark:text-white tracking-tight">PurchaseVault</span>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-600 font-medium">
          © {new Date().getFullYear()} PurchaseVault. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-sm font-semibold text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors">
            Sign In
          </Link>
          <Link to="/register" className="text-sm font-semibold text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors">
            Register
          </Link>
        </div>
      </div>
    </footer>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <LandingNav />
      <HeroSection />
      <StatsBar />
      <FeaturesGrid />
      <HowItWorks />
      <CtaBanner />
      <Footer />
    </div>
  )
}
