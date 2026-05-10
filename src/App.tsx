import { useState, useRef, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/views/Dashboard'
import Todos from '@/views/Todos'
import Notes from '@/views/Notes'
import AI from '@/views/AI'
import Calendar from '@/views/Calendar'
import Email from '@/views/Email'
import Chat from '@/views/Chat'
import Settings from '@/views/Settings'
import { useTodos } from '@/store/useTodos'
import { useNotes } from '@/store/useNotes'
import { useCalendar } from '@/store/useCalendar'
import { useSettings } from '@/store/useSettings'
import { usePolling } from '@/hooks/usePolling'
import type { View } from '@/types'

interface Toast { title: string; body: string; view: 'email' | 'chat' }

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [badges, setBadges] = useState<Partial<Record<View, number>>>({})
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const todos = useTodos()
  const notes = useNotes()
  const calendar = useCalendar()
  const { settings, updateSettings } = useSettings()

  const handleBadge = useCallback((v: 'email' | 'chat', n: number) => {
    setBadges(p => ({ ...p, [v]: n }))
  }, [])

  const handleToast = useCallback((title: string, body: string, v: 'email' | 'chat') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ title, body, view: v })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const navigate = useCallback((v: View) => setView(v), [])

  usePolling({ settings, onBadge: handleBadge, onToast: handleToast, navigate })

  function handleNavigate(v: View) {
    setView(v)
    if (v === 'email') setBadges(p => ({ ...p, email: 0 }))
    if (v === 'chat')  setBadges(p => ({ ...p, chat: 0 }))
  }

  return (
    <div className="flex h-screen bg-[#0d0d1a] text-gray-100 overflow-hidden">
      <Sidebar current={view} onNavigate={handleNavigate} badges={badges} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {view === 'dashboard' && (
          <Dashboard todos={todos} notes={notes} calendar={calendar} settings={settings} onNavigate={handleNavigate} />
        )}
        {view === 'todos'    && <Todos todos={todos} />}
        {view === 'notes'    && <Notes notes={notes} />}
        {view === 'calendar' && <Calendar calendar={calendar} settings={settings} />}
        {view === 'email'    && <Email settings={settings} onNavigate={handleNavigate} />}
        {view === 'chat'     && <Chat settings={settings} onNavigate={handleNavigate} />}
        {view === 'ai'       && <AI todos={todos} notes={notes} calendar={calendar} settings={settings} />}
        {view === 'settings' && <Settings settings={settings} onSave={updateSettings} />}
      </main>

      {/* In-app toast */}
      {toast && (
        <div
          onClick={() => { handleNavigate(toast.view); setToast(null) }}
          className="fixed bottom-5 right-5 z-50 max-w-xs bg-surface border border-surface-border rounded-2xl p-4 shadow-2xl cursor-pointer hover:bg-surface-hover transition-all animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">{toast.view === 'email' ? '📧' : '💬'}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{toast.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToast(null) }}
              className="text-gray-600 hover:text-gray-300 text-lg leading-none shrink-0 ml-1"
            >×</button>
          </div>
        </div>
      )}
    </div>
  )
}
