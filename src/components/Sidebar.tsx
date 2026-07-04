import type { View } from '@/types'
import NavIcon from '@/components/NavIcon'

interface NavItem { id: View; label: string }

const nav: NavItem[] = [
  { id: 'dashboard', label: '홈' },
  { id: 'todos', label: '할 일' },
  { id: 'notes', label: '노트' },
  { id: 'calendar', label: '캘린더' },
  { id: 'email', label: '이메일' },
  { id: 'chat', label: '채팅' },
  { id: 'ai', label: 'AI' },
  { id: 'journal', label: '저널' },
  { id: 'mental_avatar', label: '멘탈 아바타' },
  { id: 'history', label: '기록' },
  { id: 'preference', label: '성향' },
  { id: 'settings', label: '설정' },
]

interface Props {
  current: View
  onNavigate: (v: View) => void
  badges?: Partial<Record<View, number>>
}

export default function Sidebar({ current, onNavigate, badges = {} }: Props) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-surface-border bg-white/95 backdrop-blur-xl md:static md:z-auto md:flex md:h-auto md:w-20 md:shrink-0 md:flex-col md:border-r md:border-t-0 md:bg-white/80">
      <div className="hidden h-20 items-center justify-center border-b border-surface-border md:flex">
        <span className="flex h-10 w-10 select-none items-center justify-center rounded-2xl bg-gray-950 text-sm font-black tracking-tight text-white shadow-sm">MY</span>
      </div>

      <nav className="flex h-full items-center gap-1 overflow-x-auto px-2 md:h-auto md:flex-1 md:flex-col md:items-stretch md:gap-1.5 md:overflow-y-auto md:p-2 md:pt-4">
        {nav.map(({ id, label }) => {
          const badge = badges[id] ?? 0
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              aria-label={label}
              className={`relative flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-150 select-none md:w-full md:min-w-0 md:py-2.5 ${
                current === id
                  ? 'bg-gray-950 text-white shadow-md shadow-gray-950/10'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-950'
              }`}
            >
              <NavIcon view={id} />
              <span className="max-w-full truncate text-[9px] leading-none">{label}</span>
              {badge > 0 && (
                <span className="absolute right-1.5 top-1 flex h-3.5 min-w-[15px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
