import { cn } from '../../lib/utils'

type SkeletonVariant = 'card' | 'text' | 'circle'

interface SkeletonProps {
  variant?: SkeletonVariant
  className?: string
  count?: number
}

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-800 rounded',
        className,
      )}
    />
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBase className="h-5 w-20 rounded-full" />
        <SkeletonBase className="h-4 w-16" />
      </div>
      <SkeletonBase className="h-6 w-3/4 mb-2" />
      <SkeletonBase className="h-4 w-1/2 mb-4" />
      <SkeletonBase className="h-2 w-full rounded-full mb-4" />
      <div className="flex justify-between">
        <SkeletonBase className="h-4 w-24" />
        <SkeletonBase className="h-4 w-24" />
      </div>
    </div>
  )
}

export function Skeleton({ variant = 'text', className, count = 1 }: SkeletonProps) {
  if (variant === 'card') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </>
    )
  }

  if (variant === 'circle') {
    return <SkeletonBase className={cn('rounded-full', className)} />
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBase key={i} className={cn('h-4 w-full', className)} />
      ))}
    </>
  )
}
