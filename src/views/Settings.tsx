import { useState } from 'react'
import type { Settings } from '@/types'

interface Props {
  settings: Settings
  onSave: (patch: Partial<Settings>) => void
}

export default function SettingsView({ settings, onSave }: Props) {
  const [form, setForm] = useState({ ...settings })
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Field = ({
    label, field, type = 'text', placeholder = '', hint,
  }: { label: string; field: keyof Settings; type?: string; placeholder?: string; hint?: string }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <input
        type={type}
        value={form[field] as string}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-surface rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50"
      />
      {hint && <p className="text-xs text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  )

  const Badge = ({ connected }: { connected: boolean }) => connected
    ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">연결됨</span>
    : null

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-white mb-6">⚙ 설정</h1>

        <form onSubmit={handleSave} className="space-y-5">
          {/* 프로필 */}
          <Section title="프로필">
            <Field label="이름" field="userName" placeholder="사용자 이름" />
            <Field label="도시 (날씨용)" field="city" placeholder="예: 서울, Seoul" />
          </Section>

          {/* AI */}
          <Section title="Anthropic (AI 기능)" badge={<Badge connected={!!settings.anthropicApiKey} />}>
            <Field
              label="API 키" field="anthropicApiKey" type="password" placeholder="sk-ant-..."
              hint="Anthropic Console에서 발급 · AI 브리핑·리뷰·전략 대화에 사용됩니다."
            />
          </Section>

          {/* 날씨 */}
          <Section title="OpenWeatherMap (날씨)" badge={<Badge connected={!!settings.weatherApiKey} />}>
            <Field
              label="API 키" field="weatherApiKey" type="password" placeholder="무료 API 키"
              hint="openweathermap.org 무료 계정으로 발급 · 홈 화면 날씨 위젯에 사용됩니다."
            />
          </Section>

          {/* Google – Gmail + Calendar */}
          <Section
            title="Google (Gmail + Calendar)"
            badge={<Badge connected={!!settings.gmailClientId} />}
          >
            <Field
              label="OAuth2 Client ID" field="gmailClientId"
              placeholder="123456789-xxx.apps.googleusercontent.com"
              hint="하나의 Client ID로 Gmail 이메일과 Google Calendar를 모두 연결합니다."
            />
            <div className="bg-surface-card rounded-lg p-3 space-y-1.5 text-xs text-gray-500 leading-relaxed">
              <p className="font-medium text-gray-400">발급 방법</p>
              <p>① Google Cloud Console → 새 프로젝트 생성</p>
              <p>② API 및 서비스 → Gmail API, Google Calendar API 사용 설정</p>
              <p>③ 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)</p>
              <p>④ 승인된 JavaScript 원본에 <code className="bg-surface px-1 rounded">http://localhost:5173</code> 추가</p>
            </div>
          </Section>

          {/* Slack */}
          <Section title="💬 채팅 – Slack" badge={<Badge connected={!!settings.slackToken} />}>
            <Field
              label="Bot Token" field="slackToken" type="password" placeholder="xoxb-..."
              hint="api.slack.com/apps → Bot Token Scopes: channels:read, channels:history, groups:read, groups:history, users:read"
            />
            <Field
              label="기본 채널 ID (선택)" field="slackChannelId" placeholder="C0XXXXXXXXX"
              hint="채널 우클릭 → 링크 복사 → URL 끝 ID. 비워두면 가입된 첫 채널이 자동 선택됩니다."
            />
          </Section>

          {/* Telegram */}
          <Section title="💬 채팅 – Telegram Bot" badge={<Badge connected={!!settings.telegramToken} />}>
            <Field
              label="Bot API Token" field="telegramToken" type="password" placeholder="1234567890:AAF..."
              hint="Telegram @BotFather → /newbot → 토큰 발급. 봇에게 보낸 메시지가 대시보드에 표시됩니다."
            />
          </Section>

          <button
            type="submit"
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-green-500 text-white' : 'bg-accent hover:bg-accent-hover text-white'
            }`}
          >
            {saved ? '✓ 저장됨' : '저장'}
          </button>
        </form>

        {/* 폴링 간격 안내 */}
        <div className="mt-5 bg-surface/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400">🔔 실시간 알림 주기</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Gmail: 2분마다 새 메일 확인</p>
            <p>• Slack: 30초마다 새 메시지 확인</p>
            <p>• Telegram: 15초마다 새 메시지 확인</p>
            <p className="pt-1 text-gray-700">새 메시지 도착 시 브라우저 알림 + 화면 우하단 토스트가 표시됩니다. (브라우저 알림 권한 필요)</p>
          </div>
        </div>

        <div className="mt-3 bg-surface/50 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-medium text-gray-400">💾 데이터 저장</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            모든 설정은 브라우저 localStorage에만 저장됩니다. 서버로 전송되지 않으며, API 키는 외부에 노출되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, badge }: {
  title: string; children: React.ReactNode; badge?: React.ReactNode
}) {
  return (
    <section className="bg-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-accent-light">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  )
}
