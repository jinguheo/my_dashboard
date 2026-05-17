import { useState, useEffect } from 'react'
import type { Settings } from '@/types'

const KEY = 'dash-settings'
const DEFAULTS: Settings = {
  anthropicApiKey: '',
  openaiApiKey: '',
  customAiEndpoint: '',
  customAiModel: '',
  aiProvider: 'claude',
  claudeSessionKey: '',
  weatherApiKey: '',
  finnhubApiKey: '',
  city: '화성',
  weatherCities: '화성',
  userName: '사용자',
  dailyRoutine: '',
  stockSymbols: '005930.KS, 000660.KS, 042700.KS, ^KS11, ^IXIC, ^GSPC, NVDA',
  mcpEndpoint: 'http://127.0.0.1:8765/mcp',
  dataAccessMode: 'mcp',
  gmailClientId: '',
  mailAccounts: [],
  calendarAccounts: [],
  slackToken: '',
  slackChannelId: '',
  telegramToken: '',
  chatConnections: [],
}

function normalizeSettings(raw: Partial<Settings>): Settings {
  const merged = { ...DEFAULTS, ...raw }

  if ((!merged.mailAccounts || merged.mailAccounts.length === 0) && merged.gmailClientId) {
    merged.mailAccounts = [{
      id: 'gmail-default',
      name: 'Gmail',
      provider: 'gmail',
      clientId: merged.gmailClientId,
    }]
  }

  if ((!merged.calendarAccounts || merged.calendarAccounts.length === 0) && merged.gmailClientId) {
    merged.calendarAccounts = [{
      id: 'gcal-default',
      name: 'Google Calendar',
      provider: 'google',
      clientId: merged.gmailClientId,
    }]
  }

  if (!merged.chatConnections || merged.chatConnections.length === 0) {
    const connections = []
    if (merged.slackToken) {
      connections.push({
        id: 'slack-default',
        name: 'Slack',
        platform: 'slack' as const,
        token: merged.slackToken,
        channelId: merged.slackChannelId,
      })
    }
    if (merged.telegramToken) {
      connections.push({
        id: 'telegram-default',
        name: 'Telegram',
        platform: 'telegram' as const,
        token: merged.telegramToken,
      })
    }
    merged.chatConnections = connections
  }

  return merged
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return normalizeSettings(JSON.parse(localStorage.getItem(KEY) || '{}'))
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
