import { useState, type FormEvent } from 'react'

interface SearchEngine {
  label: string
  url: string
}

interface Props {
  userName: string
  dateLabel: string
  searchQuery: string
  searchEngine: string
  searchEngines: Record<string, SearchEngine>
  showAi: boolean
  editMode: boolean
  onSearchQueryChange: (value: string) => void
  onSearchEngineChange: (value: string) => void
  onSearch: (event: FormEvent) => void
  onNavigateTodos: () => void
  onNavigateSettings: () => void
  onNavigateAi: () => void
  onRestartServers: () => Promise<void>
  onToggleAi: () => void
  onToggleEdit: () => void
}

export default function DashboardHeader({
  userName,
  dateLabel,
  searchQuery,
  searchEngine,
  searchEngines,
  showAi,
  editMode,
  onSearchQueryChange,
  onSearchEngineChange,
  onSearch,
  onNavigateTodos,
  onNavigateSettings,
  onNavigateAi,
  onRestartServers,
  onToggleAi,
  onToggleEdit,
}: Props) {
  const [restarting, setRestarting] = useState(false)

  async function restartServers() {
    setRestarting(true)
    try {
      await onRestartServers()
    } finally {
      window.setTimeout(() => setRestarting(false), 3000)
    }
  }

  return (
    <div className="shrink-0 space-y-4 px-4 pt-5 sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="dashboard-kicker mb-1">오늘의 대시보드</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-[28px]">안녕하세요, {userName}님</h1>
          <p className="mt-0.5 text-sm text-gray-500">{dateLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={restartServers}
            disabled={restarting}
            title="MCP · Vite 서버 재시작"
            className="rounded-xl border border-surface-border bg-white px-3 py-2 text-xs text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {restarting ? '재시작 중…' : '↺ 서버 재시작'}
          </button>
          <button onClick={onNavigateTodos} className="rounded-xl border border-surface-border bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-surface-hover">
            할 일 관리
          </button>
          <button onClick={onNavigateSettings} className="hidden rounded-xl border border-surface-border bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-surface-hover sm:inline-flex">
            연결 설정
          </button>
          <button onClick={onNavigateAi} className="rounded-xl bg-gray-950 px-3 py-2 text-white shadow-sm transition-colors hover:bg-gray-800">
            AI 브리핑
          </button>
          <button onClick={onToggleAi} title="AI 패널 토글" aria-pressed={showAi} className="rounded-xl border border-surface-border bg-white px-2.5 py-2 text-xs text-gray-500 transition-colors hover:bg-surface-hover">
            {showAi ? 'AI 숨기기' : 'AI 보기'}
          </button>
          <button onClick={onToggleEdit} aria-pressed={editMode} className={`rounded-xl border px-2.5 py-2 text-xs transition-colors ${editMode ? 'border-blue-600 bg-blue-600 text-white' : 'border-surface-border bg-white text-gray-500 hover:bg-surface-hover'}`}>
            {editMode ? '완료' : '배치 편집'}
          </button>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex gap-2" role="search">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card focus-within:border-gray-400">
          <label htmlFor="dashboard-search-engine" className="sr-only">검색 엔진</label>
          <select
            id="dashboard-search-engine"
            value={searchEngine}
            onChange={event => onSearchEngineChange(event.target.value)}
            className="w-[92px] shrink-0 border-r border-surface-border bg-gray-50 px-3 text-xs text-gray-500 outline-none sm:w-auto"
          >
            {Object.entries(searchEngines).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <label htmlFor="dashboard-search-query" className="sr-only">검색어</label>
          <input
            id="dashboard-search-query"
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            placeholder="검색어를 입력하세요..."
            className="min-w-0 flex-1 px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none sm:px-4"
          />
        </div>
        <button type="submit" className="rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 sm:px-5">
          검색
        </button>
      </form>
    </div>
  )
}
