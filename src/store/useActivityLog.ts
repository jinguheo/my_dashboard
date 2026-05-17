import { useState, useEffect } from 'react'
import { getTodayActivities, removeActivity, type ActivityEntry } from '@/services/activityLog'

export function useActivityLog() {
  const [activities, setActivities] = useState<ActivityEntry[]>(getTodayActivities)

  useEffect(() => {
    const refresh = () => setActivities(getTodayActivities())
    window.addEventListener('activity-logged', refresh)
    return () => window.removeEventListener('activity-logged', refresh)
  }, [])

  return { activities, remove: removeActivity }
}
