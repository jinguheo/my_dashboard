import { useState, useEffect } from 'react'
import type { Settings } from '@/types'

const KEY = 'dash-settings'
const DEFAULTS: Settings = {
  anthropicApiKey: '',
  weatherApiKey: '',
  city: '서울',
  userName: '사용자',
  gmailClientId: '',
  slackToken: '',
  slackChannelId: '',
  telegramToken: '',
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch { return DEFAULTS }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  function updateSettings(patch: Partial<Settings>) {
    setSettings(p => ({ ...p, ...patch }))
  }

  return { settings, updateSettings }
}
