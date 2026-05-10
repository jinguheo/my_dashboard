import { useEffect, useRef } from 'react'
import type { Settings, View } from '@/types'
import { getStoredToken, fetchInbox } from '@/services/gmail'
import { fetchMessages } from '@/services/slack'
import { fetchTelegramRaw, senderName } from '@/services/telegram'

const GMAIL_MS = 2 * 60 * 1000
const SLACK_MS = 30 * 1000
const TG_MS = 15 * 1000

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

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const accounts = settings.mailAccounts.filter(account => getStoredToken(account.id))
    if (accounts.length === 0) return
    let initialized = false

    async function poll() {
      let unreadTotal = 0
      for (const account of accounts) {
        const token = getStoredToken(account.id)
        if (!token) continue
        const idsKey = `poll-gmail-ids:${account.id}`
        try {
          const emails = await fetchInbox(token, 15, account.id)
          const unreadIds = emails.filter(e => !e.isRead).map(e => e.id)
          const prev: string[] = JSON.parse(localStorage.getItem(idsKey) || '[]')
          unreadTotal += unreadIds.length

          if (!initialized) {
            localStorage.setItem(idsKey, JSON.stringify(unreadIds))
            continue
          }

          const newIds = unreadIds.filter(id => !prev.includes(id))
          if (newIds.length > 0) {
            const latest = emails.find(e => e.id === newIds[0])!
            const title = `메일: ${account.name || latest.from}`
            const body = latest.subject
            browserNotify(title, body, () => notifyRef.current.navigate('email'))
            notifyRef.current.onToast(title, body, 'email')
          }
          localStorage.setItem(idsKey, JSON.stringify(unreadIds))
        } catch {}
      }
      if (!initialized) initialized = true
      notifyRef.current.onBadge('email', unreadTotal)
    }

    poll()
    const id = setInterval(poll, GMAIL_MS)
    return () => clearInterval(id)
  }, [settings.mailAccounts])

  useEffect(() => {
    const connections = settings.chatConnections.filter(c => c.platform === 'slack' && c.token && c.channelId)
    if (connections.length === 0) return
    let initialized = false

    async function poll() {
      let badgeTotal = 0
      for (const connection of connections) {
        const tsKey = `poll-slack-ts:${connection.id}`
        try {
          const msgs = await fetchMessages(connection.token!, connection.channelId!, 5)
          if (!msgs.length) continue
          const latestTs = msgs[0].ts
          const prevTs = localStorage.getItem(tsKey) || '0'

          if (!initialized) {
            localStorage.setItem(tsKey, latestTs)
            continue
          }

          const newMsgs = msgs.filter(m => m.ts > prevTs)
          if (newMsgs.length > 0) {
            const m = newMsgs[0]
            badgeTotal += newMsgs.length
            const title = `Slack ${connection.name}: ${m.username || m.user}`
            const body = m.text.slice(0, 80)
            browserNotify(title, body, () => notifyRef.current.navigate('chat'))
            notifyRef.current.onToast(title, body, 'chat')
          }
          localStorage.setItem(tsKey, latestTs)
        } catch {}
      }
      if (!initialized) initialized = true
      if (badgeTotal > 0) notifyRef.current.onBadge('chat', badgeTotal)
    }

    poll()
    const id = setInterval(poll, SLACK_MS)
    return () => clearInterval(id)
  }, [settings.chatConnections])

  useEffect(() => {
    const connections = settings.chatConnections.filter(c => c.platform === 'telegram' && c.token)
    if (connections.length === 0) return
    let initialized = false

    async function poll() {
      let badgeTotal = 0
      for (const connection of connections) {
        const offsetKey = `poll-tg-offset:${connection.id}`
        try {
          const stored = localStorage.getItem(offsetKey)
          const offset = stored ? parseInt(stored) : undefined
          const { messages, nextOffset } = await fetchTelegramRaw(connection.token!, offset, 10)

          if (nextOffset !== null) localStorage.setItem(offsetKey, String(nextOffset))
          if (!initialized) continue

          if (messages.length > 0) {
            const latest = messages[messages.length - 1]
            badgeTotal += messages.length
            const title = `Telegram ${connection.name}: ${senderName(latest)}`
            const body = latest.text?.slice(0, 80) || ''
            browserNotify(title, body, () => notifyRef.current.navigate('chat'))
            notifyRef.current.onToast(title, body, 'chat')
          }
        } catch {}
      }
      if (!initialized) initialized = true
      if (badgeTotal > 0) notifyRef.current.onBadge('chat', badgeTotal)
    }

    poll()
    const id = setInterval(poll, TG_MS)
    return () => clearInterval(id)
  }, [settings.chatConnections])
}
