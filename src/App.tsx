import { useState, useRef, useCallback, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Dashboard from '@/views/Dashboard'
import Todos from '@/views/Todos'
import Notes from '@/views/Notes'
import AI from '@/views/AI'
import Calendar from '@/views/Calendar'
import Email from '@/views/Email'
import Chat from '@/views/Chat'
import Settings from '@/views/Settings'
import History from '@/views/History'
import KnowledgeGraph from '@/views/KnowledgeGraph'
import AvatarStudio from '@/views/AvatarStudio'
import Journal from '@/views/Journal'
import SetupWizard from '@/components/SetupWizard'
import { useTodos } from '@/store/useTodos'
import { useNotes } from '@/store/useNotes'
import { useCalendar } from '@/store/useCalendar'
import { useJournal } from '@/store/useJournal'
import { useSettings } from '@/store/useSettings'
import { usePolling } from '@/hooks/usePolling'
import { saveSnapshot, hasSnapshotToday, todayStr } from '@/services/snapshot'
import { logActivity } from '@/services/activityLog'
import { claudeWebAutoConnect } from '@/services/claudeWeb'
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
  const journal = useJournal()

  const noAi = !settings.anthropicApiKey && !settings.claudeSessionKey && !settings.openaiApiKey && !settings.customAiEndpoint
  const [showWizard, setShowWizard] = useState(() => noAi && !localStorage.getItem('wizard-skipped'))

  const handleBadge = useCallback((v: 'email' | 'chat', n: number) => {
    setBadges(p => ({ ...p, [v]: n }))
  }, [])

  const handleToast = useCallback((title: string, body: string, v: 'email' | 'chat') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ title, body, view: v })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const handleNavigate = useCallback((v: View) => {
    setView(v)
    if (v === 'email') { setBadges(p => ({ ...p, email: 0 })); logActivity('email', '이메일 확인') }
    if (v === 'chat')  { setBadges(p => ({ ...p, chat: 0 }));  logActivity('chat', '채팅 확인') }
  }, [])

  usePolling({ settings, onBadge: handleBadge, onToast: handleToast, navigate: handleNavigate })

  // 시작 시 Chrome 쿠키에서 Claude.ai 세션 키 자동 갱신
  useEffect(() => {
    if (!settings.mcpEndpoint) return
    claudeWebAutoConnect(settings.mcpEndpoint).then(key => {
      if (key && key !== settings.claudeSessionKey) {
        updateSettings({ claudeSessionKey: key, aiProvider: 'claude-web' })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 하루 첫 접속 시 스냅샷 자동 저장 (마운트 시점 값 사용이 의도적)
  useEffect(() => {
    if (!hasSnapshotToday()) {
      saveSnapshot({
        todos: todos.todos,
        notes: notes.notes,
        calendarEvents: calendar.events,
        briefing: localStorage.getItem(`briefing-${todayStr()}`) || '',
        completedCount: todos.completedToday.length,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 브리핑 생성 후 스냅샷 갱신 (briefing localStorage 변화 감지)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `briefing-${todayStr()}`) {
        saveSnapshot({
          todos: todos.todos,
          notes: notes.notes,
          calendarEvents: calendar.events,
          briefing: e.newValue || '',
          completedCount: todos.completedToday.length,
        })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [todos.todos, notes.notes, calendar.events, todos.completedToday.length])

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      {showWizard && (
        <SetupWizard
          onComplete={(patch) => { updateSettings(patch); setShowWizard(false) }}
          onSkip={() => { localStorage.setItem('wizard-skipped', '1'); setShowWizard(false) }}
        />
      )}
      <Sidebar current={view} onNavigate={handleNavigate} badges={badges} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {view === 'dashboard' && (
          <Dashboard todos={todos} notes={notes} calendar={calendar} settings={settings} onNavigate={handleNavigate} onUpdateSettings={updateSettings} />
        )}
        {view === 'todos'    && <Todos todos={todos} />}
        {view === 'notes'    && <Notes notes={notes} />}
        {view === 'calendar' && <Calendar calendar={calendar} settings={settings} />}
        {view === 'email'    && <Email settings={settings} onNavigate={handleNavigate} />}
        {view === 'chat'     && <Chat settings={settings} onNavigate={handleNavigate} />}
        {view === 'ai'       && <AI todos={todos} notes={notes} calendar={calendar} settings={settings} onProviderChange={(p) => updateSettings({ aiProvider: p })} />}
        {view === 'settings' && <Settings settings={settings} onSave={updateSettings} />}
        {view === 'history'   && <History />}
        {view === 'knowledge' && <KnowledgeGraph settings={settings} />}
        {view === 'journal'   && <Journal journal={journal} sessionKey={settings.claudeSessionKey} />}
        {view === 'avatar'    && <AvatarStudio />}
      </main>

      {/* In-app toast */}
      {toast && (
        <div
          onClick={() => { handleNavigate(toast.view); setToast(null) }}
          className="fixed bottom-5 right-5 z-50 max-w-xs bg-white border border-surface-border rounded-2xl p-4 shadow-lg cursor-pointer hover:bg-surface-hover transition-all animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">{toast.view === 'email' ? '📧' : '💬'}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{toast.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToast(null) }}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none shrink-0 ml-1"
            >×</button>
          </div>
        </div>
      )}
    </div>
  )
}
