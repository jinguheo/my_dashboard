const CHANNELS = ['# general', '# dev', '# design']
const DUMMY_MESSAGES = [
  { id: '1', user: 'Alice', text: '오늘 배포 어떻게 됐어요?', time: '10:15', channel: '# dev' },
  { id: '2', user: 'Bob', text: '성공적으로 완료됐습니다 🎉', time: '10:17', channel: '# dev' },
  { id: '3', user: 'Carol', text: '새 디자인 시안 공유드렸어요', time: '09:50', channel: '# design' },
]

export default function ChatCard() {
  return (
    <div className="flex h-full gap-2">
      <div className="flex flex-col gap-1 w-24 flex-shrink-0 border-r border-surface-border pr-2">
        {CHANNELS.map(ch => (
          <button
            key={ch}
            className="text-left text-xs text-gray-400 hover:text-gray-200 hover:bg-surface-hover px-2 py-1 rounded transition-colors truncate"
          >
            {ch}
          </button>
        ))}
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-2">
        <div className="flex-1 overflow-y-auto space-y-2">
          {DUMMY_MESSAGES.map(msg => (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-accent">{msg.user}</span>
                <span className="text-xs text-gray-600">{msg.time}</span>
              </div>
              <p className="text-sm text-gray-300">{msg.text}</p>
            </div>
          ))}
        </div>
        <button className="w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-gray-500 hover:border-accent hover:text-accent transition-colors">
          🔗 Slack 연동하기
        </button>
      </div>
    </div>
  )
}
