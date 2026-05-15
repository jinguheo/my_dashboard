import { useState, useEffect } from 'react'

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string
}

const defaults: Bookmark[] = [
  { id: '0', url: 'https://www.youtube.com', title: 'YouTube', favicon: 'https://www.youtube.com/favicon.ico' },
  { id: '1', url: 'https://github.com', title: 'GitHub', favicon: 'https://github.com/favicon.ico' },
  { id: '2', url: 'https://www.google.com', title: 'Google', favicon: 'https://www.google.com/favicon.ico' },
  { id: '3', url: 'https://mail.google.com', title: 'Gmail', favicon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
  { id: '4', url: 'https://drive.google.com', title: 'Drive', favicon: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png' },
  { id: '5', url: 'https://calendar.google.com', title: 'Calendar', favicon: 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico' },
]

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bookmarks') || JSON.stringify(defaults))
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  function add(url: string, title?: string) {
    const clean = url.startsWith('http') ? url : `https://${url}`
    const host = new URL(clean).hostname
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      url: clean,
      title: title || host,
      favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=32`,
    }
    setBookmarks(prev => [...prev, bm])
  }

  function remove(id: string) {
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }

  return { bookmarks, add, remove }
}
