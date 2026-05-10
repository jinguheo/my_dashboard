import { useState, useEffect } from 'react'

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string
}

const defaults: Bookmark[] = [
  { id: '1', url: 'https://github.com', title: 'GitHub', favicon: 'https://github.com/favicon.ico' },
  { id: '2', url: 'https://www.google.com', title: 'Google', favicon: 'https://www.google.com/favicon.ico' },
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
      id: Date.now().toString(),
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
