import type { View } from '@/types'

interface NavItem { id: View; label: string; icon: string }

const nav: NavItem[] = [
  { id: 'dashboard', label: '홈',    icon: '⊞' },
  { id: 'todos',     label: '할 일', icon: '✓' },
  { id: 'notes',     label: '노트',  icon: '✎' },
  { id: 'calendar',  label: '캘린더', icon: '◫' },
  { id: 'email',     label: '이메일', icon: '✉' },
  { id: 'chat',      label: '채팅',  icon: '◎' },
  { id: 'ai',        label: 'AI',   icon: '✦' },
  { id: 'history',   label: '기록',  icon: '◷' },
]

interface Props {
  current: View
  onNavigate: (v: View) => void
  badges?: Partial<Record<View, number>>
}

export default function Sidebar({ current, onNavigate, badges = {} }: Props) {
  return (
    <aside className="w-16 flex flex-col bg-gray-50 border-r border-surface-border shrink-0">
      <div className="h-14 flex items-center justify-center border-b border-surface-border">
        <span className="text-gray-900 font-bold text-lg select-none">D</span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-2 pt-3">
        {nav.map(({ id, label, icon }) => {
          const badge = badges[id] ?? 0
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              className={`
                relative w-full flex flex-col items-center gap-0.5 py-2.5 rounded-xl
                text-xs font-medium transition-all duration-150 select-none
                ${current === id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}
              `}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[9px] leading-none">{label}</span>
              {badge > 0 && (
                <span className="absolute top-1 right-1.5 min-w-[15px] h-3.5 bg-red-500 text-[8px] text-white font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-2 pb-3">
        <button
          onClick={() => onNavigate('settings')}
          title="설정"
          className={`
            w-full flex flex-col items-center gap-0.5 py-2.5 rounded-xl
            text-xs font-medium transition-all duration-150 select-none
            ${current === 'settings'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}
          `}
        >
          <span className="text-base leading-none">⚙</span>
          <span className="text-[9px] leading-none">설정</span>
        </button>
      </div>
    </aside>
  )
}
