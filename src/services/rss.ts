export interface RssItem {
  title: string
  link: string
  date: string
  source: string
  summary?: string
}

export const POPULAR_RSS_FEEDS = [
  'https://www.yna.co.kr/rss/society.xml',
  'https://www.yna.co.kr/rss/economy.xml',
  'https://www.hankyung.com/feed/all-news',
  'https://hnrss.org/frontpage',
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/rss',
  'https://www.engadget.com/rss.xml',
  'https://www.zdnet.com/news/rss.xml',
  'https://github.blog/feed/',
  'https://huggingface.co/blog/feed.xml',
  'https://aws.amazon.com/blogs/aws/feed/',
  'https://blog.cloudflare.com/rss/',
  'https://openai.com/news/rss.xml',
  'https://security.googleblog.com/feeds/posts/default?alt=rss',
] as const

export const DEFAULT_RSS_FEEDS = POPULAR_RSS_FEEDS.join('\n')

export function mergeRssFeedUrls(current: string, feeds: readonly string[] = POPULAR_RSS_FEEDS): string {
  const seen = new Set<string>()
  const merged = [
    ...current.split('\n'),
    ...feeds,
  ]
    .map(url => url.trim())
    .filter(url => {
      if (!url || seen.has(url)) return false
      seen.add(url)
      return true
    })

  return merged.join('\n')
}

export async function fetchRssFeedsFromMcp(endpoint: string, urls: string[]): Promise<RssItem[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'rss.feed', arguments: { urls, maxPerFeed: 8 } },
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
