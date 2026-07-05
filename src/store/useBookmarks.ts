import { useState, useEffect, useCallback, useMemo } from 'react'

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string
  clicks: number
}

function normalize(bm: unknown): Bookmark {
  const b = bm as Record<string, unknown>
  return {
    id: String(b.id ?? ''),
    url: String(b.url ?? ''),
    title: String(b.title ?? ''),
    favicon: String(b.favicon ?? ''),
    clicks: typeof b.clicks === 'number' ? b.clicks : 0,
  }
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    url.hash = ''
    if (url.pathname === '/') url.pathname = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
  }
}

const defaults: Bookmark[] = [
  { id: '0', url: 'https://www.youtube.com',    title: 'YouTube',  favicon: 'https://www.youtube.com/favicon.ico',                                                                clicks: 0 },
  { id: '1', url: 'https://github.com',          title: 'GitHub',   favicon: 'https://github.com/favicon.ico',                                                                     clicks: 0 },
  { id: '2', url: 'https://www.google.com',      title: 'Google',   favicon: 'https://www.google.com/favicon.ico',                                                                 clicks: 0 },
  { id: '3', url: 'https://mail.google.com',     title: 'Gmail',    favicon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',                                             clicks: 0 },
  { id: '4', url: 'https://drive.google.com',    title: 'Drive',    favicon: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',                                  clicks: 0 },
  { id: '5', url: 'https://calendar.google.com', title: 'Calendar', favicon: 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',                  clicks: 0 },
]

const KEY = 'bookmarks'

function bookmarkTitle(url: URL, title?: string) {
  const explicitTitle = title?.trim()
  if (explicitTitle) return explicitTitle

  for (const key of ['title', 'topic', 'q', 'query', 'search']) {
    const value = url.searchParams.get(key)?.trim()
    if (value) return value
  }

  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastPath = pathParts[pathParts.length - 1]
  if (lastPath) {
    try {
      return decodeURIComponent(lastPath).replace(/[-_]+/g, ' ')
    } catch {
      return lastPath.replace(/[-_]+/g, ' ')
    }
  }

  return url.hostname.replace(/^www\./, '')
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || JSON.stringify(defaults))
      return (raw as unknown[]).map(normalize)
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(bookmarks))
  }, [bookmarks])

  const add = useCallback((url: string, title?: string) => {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const clean = canonicalUrl(parsed.toString())
    const host = parsed.hostname
    const nextTitle = bookmarkTitle(parsed, title)

    setBookmarks(prev => {
      const sameAddressCount = prev.filter(bookmark => canonicalUrl(bookmark.url) === clean).length
      const displayTitle = title?.trim()
        ? nextTitle
        : sameAddressCount > 0 ? `${nextTitle} ${sameAddressCount + 1}` : nextTitle

      return [...prev, {
      id: crypto.randomUUID(),
      url: clean,
      title: displayTitle,
      favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=32`,
      clicks: 0,
      }]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }, [])

  const click = useCallback((id: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, clicks: b.clicks + 1 } : b))
  }, [])

  // 클릭 많은 순 → 추가 순(id 기준)으로 정렬
  const sorted = useMemo(
    () => [...bookmarks].sort((a, b) => b.clicks - a.clicks || a.id.localeCompare(b.id)),
    [bookmarks],
  )

  return { bookmarks: sorted, add, remove, click }
}
