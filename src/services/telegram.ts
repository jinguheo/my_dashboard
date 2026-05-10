export interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; last_name?: string; username?: string }
  chat: { id: number; title?: string; first_name?: string; type: string }
  date: number
  text?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

const BASE = 'https://api.telegram.org/bot'

export async function getTelegramMe(token: string): Promise<{ first_name: string; username: string }> {
  const res = await fetch(`${BASE}${token}/getMe`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Telegram 연결 실패')
  return data.result
}

export async function fetchTelegramUpdates(
  token: string,
  offset?: number,
  limit = 30,
): Promise<TelegramMessage[]> {
  const { messages } = await fetchTelegramRaw(token, offset, limit)
  return messages.reverse()
}

export async function fetchTelegramRaw(
  token: string,
  offset?: number,
  limit = 30,
): Promise<{ messages: TelegramMessage[]; nextOffset: number | null }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (offset !== undefined) params.set('offset', String(offset))
  const res = await fetch(`${BASE}${token}/getUpdates?${params}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Telegram API 오류')

  const updates = data.result as TelegramUpdate[]
  const messages = updates
    .map(u => u.message)
    .filter((m): m is TelegramMessage => !!m && !!m.text)

  const lastUpdateId = updates.length > 0 ? updates[updates.length - 1].update_id : null
  const nextOffset = lastUpdateId !== null ? lastUpdateId + 1 : null

  return { messages, nextOffset }
}

export function formatTgDate(unixTs: number): string {
  const d = new Date(unixTs * 1000)
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function senderName(msg: TelegramMessage): string {
  if (msg.from?.first_name) {
    return [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
  }
  return msg.chat.title || msg.chat.first_name || '알 수 없음'
}
