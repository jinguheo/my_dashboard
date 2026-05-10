export interface SlackChannel {
  id: string
  name: string
  is_member: boolean
}

export interface SlackMessage {
  ts: string
  user: string
  username?: string
  text: string
  bot_id?: string
}

export interface SlackUser {
  id: string
  real_name: string
  display_name: string
  image_48: string
}

const API = 'https://slack.com/api'

async function slackFetch(endpoint: string, token: string) {
  const res = await fetch(`${API}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Slack API 오류')
  return data
}

export async function fetchChannels(token: string): Promise<SlackChannel[]> {
  const data = await slackFetch(
    'conversations.list?types=public_channel,private_channel&limit=50&exclude_archived=true',
    token,
  )
  return (data.channels || []).filter((c: SlackChannel) => c.is_member)
}

export async function fetchMessages(token: string, channelId: string, limit = 30): Promise<SlackMessage[]> {
  const data = await slackFetch(
    `conversations.history?channel=${channelId}&limit=${limit}`,
    token,
  )
  return data.messages || []
}

export async function fetchUserName(token: string, userId: string): Promise<string> {
  try {
    const data = await slackFetch(`users.info?user=${userId}`, token)
    return data.user?.real_name || data.user?.name || userId
  } catch {
    return userId
  }
}

export function formatSlackTs(ts: string): string {
  const d = new Date(parseFloat(ts) * 1000)
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
