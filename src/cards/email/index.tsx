const DUMMY_EMAILS = [
  { id: '1', from: 'team@company.com', subject: '주간 회의 일정 안내', time: '09:32', read: false },
  { id: '2', from: 'noreply@github.com', subject: 'PR #42 merged', time: '어제', read: true },
  { id: '3', from: 'newsletter@dev.to', subject: 'Top 10 React patterns', time: '어제', read: true },
  { id: '4', from: 'admin@service.io', subject: '청구서가 발행되었습니다', time: '2일 전', read: false },
]

export default function EmailCard() {
  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-y-auto space-y-1">
        {DUMMY_EMAILS.map(email => (
          <div
            key={email.id}
            className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer hover:bg-surface-hover transition-colors ${
              !email.read ? 'border-l-2 border-accent' : ''
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${email.read ? 'bg-transparent' : 'bg-accent'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs truncate ${email.read ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>
                  {email.from}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">{email.time}</span>
              </div>
              <p className={`text-sm truncate ${email.read ? 'text-gray-500' : 'text-gray-300'}`}>
                {email.subject}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-gray-500 hover:border-accent hover:text-accent transition-colors">
        🔗 Gmail 연동하기
      </button>
    </div>
  )
}
