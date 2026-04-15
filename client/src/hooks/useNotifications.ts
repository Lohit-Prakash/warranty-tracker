import { useState, useEffect, useCallback, useRef } from 'react'
import { notificationsApi } from '../lib/api'
import type { AppNotification } from '../types'

const POLL_INTERVAL_MS = 60_000 // refresh unread count every 60 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetch = () => {
      notificationsApi.getAll()
        .then((data) => {
          if (!cancelled) {
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false)
        })
    }

    fetch()

    // Poll periodically so the badge updates without a full page reload
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const markRead = useCallback(async (id: number) => {
    await notificationsApi.markRead(id)
    refetch()
  }, [refetch])

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead()
    refetch()
  }, [refetch])

  return { notifications, unreadCount, loading, refetch, markRead, markAllRead }
}
