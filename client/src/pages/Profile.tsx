import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { User, Lock, Palette, CreditCard, Zap, Shield, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { useUITheme } from '../hooks/useUITheme'
import { useMaterialPalette } from '../hooks/useMaterialPalette'
import { profileApi, subscriptionApi } from '../lib/api'
import { Navbar } from '../components/Navbar'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'
import type { SubscriptionInfo } from '../types'

interface ProfileFormValues {
  name: string
  email: string
  notification_email: string
  notifications_enabled: boolean
  alert_threshold: string
}

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const THRESHOLD_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]

export function Profile() {
  const { user, loading: authLoading, updateUser } = useAuth()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const { isMaterial, toggle: toggleMaterial } = useUITheme()
  const { palette, setPalette, PALETTES } = useMaterialPalette()
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>()

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    watch: watchPw,
    formState: { errors: pwErrors },
  } = useForm<PasswordFormValues>()

  const notificationsEnabled = watch('notifications_enabled')
  const newPassword = watchPw('newPassword')

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        notification_email: user.notificationEmail ?? '',
        notifications_enabled: user.notificationsEnabled,
        alert_threshold: String(user.alertThreshold ?? 30),
      })
      subscriptionApi.getStatus().then(setSubInfo).catch(() => {})
    }
  }, [user, reset])

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel your subscription? You will keep access until the end of your billing period.')) return
    setCancelLoading(true)
    try {
      await subscriptionApi.cancel(true)
      toast.success('Subscription will cancel at end of billing period.')
      setSubInfo((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev)
    } catch {
      toast.error('Failed to cancel subscription.')
    } finally {
      setCancelLoading(false)
    }
  }

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />
  }

  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true)
    try {
      const updated = await profileApi.update({
        name: data.name,
        email: data.email,
        notificationEmail: data.notification_email || null,
        notificationsEnabled: data.notifications_enabled,
        alertThreshold: parseInt(data.alert_threshold, 10),
      })
      updateUser(updated)
      toast.success('Profile updated successfully')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error ?? 'Failed to save changes.')
    } finally {
      setLoading(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setPwLoading(true)
    try {
      const msg = await profileApi.changePassword(data.currentPassword, data.newPassword)
      toast.success(msg)
      resetPw()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error ?? 'Failed to change password.')
    } finally {
      setPwLoading(false)
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar
        onSearch={() => {}}
        searchQuery=""
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile Settings</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your account and notification preferences</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Account Details */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Account Details</h2>
            </div>

            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Your name"
                error={errors.name?.message}
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                })}
              />

              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                })}
              />
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Notification Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Receive email alerts when warranties are about to expire.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-between mb-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Email Notifications</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Get notified before warranties expire</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  {...register('notifications_enabled')}
                />
                <div className={cn(
                  'w-11 h-6 rounded-full peer transition-colors',
                  'after:content-[""] after:absolute after:top-0.5 after:left-0.5',
                  'after:bg-white after:rounded-full after:h-5 after:w-5',
                  'after:transition-all after:shadow',
                  'peer-checked:after:translate-x-5',
                  notificationsEnabled
                    ? 'bg-primary-600'
                    : 'bg-gray-300 dark:bg-gray-700',
                )} />
              </label>
            </div>

            {/* Alert Threshold */}
            <div className="mb-5">
              <Select
                label="Alert Threshold"
                options={THRESHOLD_OPTIONS}
                disabled={!notificationsEnabled}
                {...register('alert_threshold')}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Get notified this many days before warranties expire
              </p>
            </div>

            {/* Notification email */}
            <Input
              type="email"
              label="Notification Email"
              placeholder="alerts@example.com"
              helperText="Leave blank to use your account email"
              disabled={!notificationsEnabled}
              error={errors.notification_email?.message}
              {...register('notification_email', {
                pattern: {
                  value: /^$|^\S+@\S+\.\S+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={loading}
              disabled={!isDirty && !loading}
              size="lg"
            >
              Save Changes
            </Button>
          </div>
        </form>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
          </div>

          <div className="space-y-1">
            {/* Dark mode */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Toggle between light and dark color scheme</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isDark} onChange={toggleDark} readOnly />
                <div className={cn(
                  'w-11 h-6 rounded-full peer transition-colors',
                  'after:content-[""] after:absolute after:top-0.5 after:left-0.5',
                  'after:bg-white after:rounded-full after:h-5 after:w-5',
                  'after:transition-all after:shadow',
                  'peer-checked:after:translate-x-5',
                  isDark ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700',
                )} />
              </label>
            </div>

            {/* Material Design */}
            <div className={cn('flex items-center justify-between py-3', isMaterial && 'border-b border-gray-100 dark:border-gray-800')}>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Material Design UI</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Rounded surfaces, elevation shadows, ripple effects — MD3</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isMaterial} onChange={toggleMaterial} readOnly />
                <div className={cn(
                  'w-11 h-6 rounded-full peer transition-colors',
                  'after:content-[""] after:absolute after:top-0.5 after:left-0.5',
                  'after:bg-white after:rounded-full after:h-5 after:w-5',
                  'after:transition-all after:shadow',
                  'peer-checked:after:translate-x-5',
                  isMaterial ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700',
                )} />
              </label>
            </div>

            {/* Color Palette — shown only when Material mode is on */}
            {isMaterial && (
              <div className="pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-widest">
                  Color Palette
                </p>
                <div className="flex flex-wrap gap-4">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPalette(p.id)}
                      title={p.label}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full transition-all duration-150 flex items-center justify-center',
                          'ring-offset-2 ring-2',
                          palette === p.id
                            ? 'ring-gray-900 dark:ring-gray-100 scale-110 shadow-md'
                            : 'ring-transparent hover:scale-105',
                        )}
                        style={{ backgroundColor: p.primary }}
                      >
                        {palette === p.id && (
                          <svg
                            className="w-5 h-5 text-white drop-shadow"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs transition-colors',
                        palette === p.id
                          ? 'font-semibold text-gray-800 dark:text-gray-200'
                          : 'text-gray-500 dark:text-gray-400',
                      )}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <form onSubmit={handleSubmitPw(onPasswordSubmit)} className="mt-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Change Password</h2>
            </div>

            <div className="space-y-4">
              <Input
                type="password"
                label="Current Password"
                placeholder="••••••••"
                error={pwErrors.currentPassword?.message}
                {...registerPw('currentPassword', { required: 'Current password is required' })}
              />
              <Input
                type="password"
                label="New Password"
                placeholder="••••••••"
                error={pwErrors.newPassword?.message}
                {...registerPw('newPassword', {
                  required: 'New password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                })}
              />
              <Input
                type="password"
                label="Confirm New Password"
                placeholder="••••••••"
                error={pwErrors.confirmPassword?.message}
                {...registerPw('confirmPassword', {
                  required: 'Please confirm your new password',
                  validate: (val) => val === newPassword || 'Passwords do not match',
                })}
              />
            </div>

            <div className="flex justify-end mt-4">
              <Button type="submit" loading={pwLoading} variant="outline">
                Change Password
              </Button>
            </div>
          </div>
        </form>

        {/* Subscription & Billing */}
        <div id="subscription" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Subscription & Billing</h2>
          </div>

          {subInfo ? (
            <div className="space-y-4">
              {/* Current tier badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    subInfo.tier === 'business' ? 'bg-purple-50 dark:bg-purple-950 text-purple-600' :
                    subInfo.tier === 'pro' ? 'bg-primary-50 dark:bg-primary-950 text-primary-600' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  )}>
                    {subInfo.tier === 'business' ? <Building2 className="h-5 w-5" /> :
                     subInfo.tier === 'pro' ? <Zap className="h-5 w-5" /> :
                     <Shield className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 capitalize">{subInfo.tier} Plan</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{subInfo.status.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold',
                  subInfo.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                  subInfo.status === 'past_due' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                )}>
                  {subInfo.status === 'active' ? 'Active' :
                   subInfo.status === 'past_due' ? 'Payment Due' :
                   subInfo.status === 'trialing' ? 'Trial' : 'Inactive'}
                </span>
              </div>

              {/* Period end */}
              {subInfo.periodEnd && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subInfo.cancelAtPeriodEnd ? 'Access until' : 'Next billing'}:{' '}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {new Date(subInfo.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong>
                </p>
              )}

              {subInfo.cancelAtPeriodEnd && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  Your subscription will cancel at the end of the billing period.
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/pricing"
                  className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md shadow-primary-600/20 transition-all"
                >
                  {subInfo.tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                </Link>
                {subInfo.tier !== 'free' && !subInfo.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={cancelLoading}
                    onClick={handleCancelSubscription}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl w-1/2" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
