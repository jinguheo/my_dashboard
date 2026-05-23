export interface RssItem {
  title: string
  link: string
  date: string
  source: string
}

export async function fetchRssFeedsFromMcp(endpoint: string, urls: string[]): Promise<RssItem[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'rss.feed', arguments: { urls, maxPerFeed: 5 } },
    }),
  })
  if (!res.ok) throw new Error('RSS 피드 요청 실패')
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return (data?.result?.content?.[0]?.json ?? data?.result ?? []) as RssItem[]
}

export function relativeRssDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const diff = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diff < 60) return `${diff}분 전`
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
    return `${Math.floor(diff / 1440)}일 전`
  } catch {
    return dateStr
  }
}
