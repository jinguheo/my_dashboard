import { useEffect, useRef } from 'react'
import type { Settings, View } from '@/types'
import { getStoredToken, fetchInbox } from '@/services/gmail'
import { fetchMessages } from '@/services/slack'
import { fetchTelegramRaw, senderName } from '@/services/telegram'

const GMAIL_MS  = 2 * 60 * 1000   // 2분
const SLACK_MS  = 30 * 1000       // 30초
const TG_MS     = 15 * 1000       // 15초

function browserNotify(title: string, body: string, onClick: () => void) {
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', silent: false })
    n.onclick = () => { window.focus(); onClick(); n.close() }
    setTimeout(() => n.close(), 8000)
  } catch {}
}

interface Options {
  settings: Settings
  onBadge: (view: 'email' | 'chat', n: number) => void
  onToast: (title: string, body: string, view: 'email' | 'chat') => void
  navigate: (v: View) => void
}

export function usePolling({ settings, onBadge, onToast, navigate }: Options) {
  const notifyRef = useRef({ onBadge, onToast, navigate })
  notifyRef.current = { onBadge, onToast, navigate }

  /* 알림 권한 요청 */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  /* Gmail 폴링 */
  useEffect(() => {
    const token = getStoredToken()
    if (!token) return

    const IDS_KEY = 'poll-gmail-ids'
    let initialized = false

    async function poll() {
      const t = getStoredToken()
      if (!t) return
      try {
        const emails = await fetchInbox(t, 15)
        const unreadIds = emails.filter(e => !e.isRead).map(e => e.id)
        const prev: string[] = JSON.parse(localStorage.getItem(IDS_KEY) || '[]')

        if (!initialized) {
          initialized = true
          localStorage.setItem(IDS_KEY, JSON.stringify(unreadIds))
          notifyRef.current.onBadge('email', unreadIds.length)
          return
        }

        const newIds = unreadIds.filter(id => !prev.includes(id))
        if (newIds.length > 0) {
          const latest = emails.find(e => e.id === newIds[0])!
          const title = `📧 ${latest.from}`
          const body = latest.subject
          browserNotify(title, body, () => notifyRef.current.navigate('email'))
          notifyRef.current.onToast(title, body, 'email')
          notifyRef.current.onBadge('email', unreadIds.length)
        }
        localStorage.setItem(IDS_KEY, JSON.stringify(unreadIds))
      } catch {}
    }

    poll()
    const id = setInterval(poll, GMAIL_MS)
    return () => clearInterval(id)
  }, [settings.gmailClientId])

  /* Slack 폴링 */
  useEffect(() => {
    if (!settings.slackToken || !settings.slackChannelId) return
    const TS_KEY = 'poll-slack-ts'
    let initialized = false

    async function poll() {
      try {
        const msgs = await fetchMessages(settings.slackToken, settings.slackChannelId, 5)
        if (!msgs.length) return
        const latestTs = msgs[0].ts
        const prevTs = localStorage.getItem(TS_KEY) || '0'

        if (!initialized) {
          initialized = true
          localStorage.setItem(TS_KEY, latestTs)
          return
        }

        const newMsgs = msgs.filter(m => m.ts > prevTs)
        if (newMsgs.length > 0) {
          const m = newMsgs[0]
          const title = `💬 Slack: ${m.username || m.user}`
          const body = m.text.slice(0, 80)
          browserNotify(title, body, () => notifyRef.current.navigate('chat'))
          notifyRef.current.onToast(title, body, 'chat')
          notifyRef.current.onBadge('chat', newMsgs.length)
        }
        localStorage.setItem(TS_KEY, latestTs)
      } catch {}
    }

    poll()
    const id = setInterval(poll, SLACK_MS)
    return () => clearInterval(id)
  }, [settings.slackToken, settings.slackChannelId])

  /* Telegram 폴링 */
  useEffect(() => {
    if (!settings.telegramToken) return
    const OFFSET_KEY = 'poll-tg-offset'
    let initialized = false

    async function poll() {
      try {
        const stored = localStorage.getItem(OFFSET_KEY)
        const offset = stored ? parseInt(stored) : undefined
        const { messages, nextOffset } = await fetchTelegramRaw(settings.telegramToken, offset, 10)

        if (nextOffset !== null) localStorage.setItem(OFFSET_KEY, String(nextOffset))

        if (!initialized) { initialized = true; return }

        if (messages.length > 0) {
          const latest = messages[messages.length - 1]
          const title = `📱 Telegram: ${senderName(latest)}`
          const body = latest.text?.slice(0, 80) || ''
          browserNotify(title, body, () => notifyRef.current.navigate('chat'))
          notifyRef.current.onToast(title, body, 'chat')
          notifyRef.current.onBadge('chat', messages.length)
        }
      } catch {}
    }

    poll()
    const id = setInterval(poll, TG_MS)
    return () => clearInterval(id)
  }, [settings.telegramToken])
}
