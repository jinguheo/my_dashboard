export interface NewsItem {
  id: string
  title: string
  url: string
  source: string
  date: string
  description?: string
  score?: number
}

export async function fetchHackerNews(count = 25): Promise<NewsItem[]> {
  const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
  const ids: number[] = await res.json()

  const items = await Promise.all(
    ids.slice(0, count).map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.json())
        .catch(() => null),
    ),
  )

  return items
    .filter((item): item is any => item && item.title)
    .map(item => ({
      id: String(item.id),
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      source: 'Hacker News',
      date: new Date(item.time * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      score: item.score,
    }))
}

export async function fetchGNews(apiKey: string, lang = 'ko', count = 20): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    lang,
    country: lang === 'ko' ? 'kr' : 'us',
    max: String(count),
    apikey: apiKey,
  })
  const res = await fetch(`https://gnews.io/api/v4/top-headlines?${params}`)
  if (!res.ok) throw new Error('GNews API 오류 – 키를 확인해주세요.')
  const data = await res.json()
  return (data.articles || []).map((a: any) => ({
    id: a.url,
    title: a.title,
    url: a.url,
    source: a.source?.name || 'GNews',
    date: new Date(a.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    description: a.description,
  }))
}
