import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { todayISO } from '../utils/date'

export const notificationsSupported = () => typeof Notification !== 'undefined'

export async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

/**
 * Daily reminder ("log your day at 17:30"). Checks each 30s while the app is open;
 * fires once per day and only if today has no tasks yet.
 */
export function useNotifications() {
  const time = useStore((s) => s.settings.reminderTime)
  useEffect(() => {
    if (!time || !notificationsSupported()) return
    const id = setInterval(() => {
      if (Notification.permission !== 'granted') return
      const d = new Date()
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const key = `worklog:v1:reminded:${useStore.getState().userId}:${todayISO()}`
      if (hhmm < time || localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      const has = useStore.getState().tasks.some((t) => t.date === todayISO() && !t.deletedAt)
      new Notification('Daybook', { body: has ? 'Review today’s tasks and mark what’s done.' : 'Log your day — nothing added yet.' })
    }, 30000)
    return () => clearInterval(id)
  }, [time])
}
