import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { ProductDetail } from './pages/ProductDetail'
import { Profile } from './pages/Profile'
import { SharedWithMe } from './pages/SharedWithMe'
import { Landing } from './pages/Landing'
import { Pricing } from './pages/Pricing'
import { useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/Toaster'
import { ErrorBoundary } from './components/ErrorBoundary'

// Heavy pages (recharts) loaded only when visited
const Analytics = lazy(() =>
  import('./pages/Analytics').then((m) => ({ default: m.Analytics })),
)

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Landing />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
      <Route path="/products/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
      <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
      <Route path="/shared" element={<ErrorBoundary><SharedWithMe /></ErrorBoundary>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route
        path="/analytics"
        element={
          <ErrorBoundary>
            <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
              <Analytics />
            </Suspense>
          </ErrorBoundary>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
