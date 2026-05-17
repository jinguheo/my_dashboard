import { useState } from 'react'
import type { Settings } from '@/types'
import { claudeWebLogin } from '@/services/claudeWeb'

type Step = 'welcome' | 'ai' | 'gmail' | 'done'
type AiMethod = 'anthropic' | 'claude-web' | 'openai' | null

interface Props {
  onComplete: (patch: Partial<Settings>) => void
  onSkip: () => void
}

export default function SetupWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [aiMethod, setAiMethod] = useState<AiMethod>(null)
  const [patch, setPatch] = useState<Partial<Settings>>({})

  function next(s: Step) { setStep(s) }
  function applyAndNext(extra: Partial<Settings>, s: Step) {
    setPatch(p => ({ ...p, ...extra }))
    setStep(s)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 상단 진행 바 */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gray-900 transition-all duration-500"
            style={{ width: step === 'welcome' ? '25%' : step === 'ai' ? '50%' : step === 'gmail' ? '75%' : '100%' }}
          />
        </div>

        <div className="p-8">
          {step === 'welcome' && (
            <WelcomeStep onNext={() => next('ai')} onSkip={onSkip} />
          )}
          {step === 'ai' && (
            <AiStep
              selected={aiMethod}
              onSelect={setAiMethod}
              onNext={(extra) => applyAndNext(extra, 'gmail')}
              onBack={() => next('welcome')}
            />
          )}
          {step === 'gmail' && (
            <GmailStep
              onNext={(extra) => applyAndNext(extra, 'done')}
              onSkip={() => next('done')}
              onBack={() => next('ai')}
              mcpEndpoint="http://127.0.0.1:8765/mcp"
            />
          )}
          {step === 'done' && (
            <DoneStep onComplete={() => onComplete(patch)} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 단계 컴포넌트들 ─────────────────────────────── */

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="text-5xl">👋</div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">처음 오셨나요?</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          2~3분이면 AI 연결을 완료할 수 있습니다.<br />
          필요한 것만 설정하고 나머지는 나중에 해도 됩니다.
        </p>
      </div>
      <div className="space-y-2">
        <button
          onClick={onNext}
          className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          시작하기 →
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          건너뛰기 (나중에 설정)
        </button>
      </div>
    </div>
  )
}

function AiStep({
  selected, onSelect, onNext, onBack,
}: {
  selected: AiMethod
  onSelect: (m: AiMethod) => void
  onNext: (patch: Partial<Settings>) => void
  onBack: () => void
}) {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [sessionInput, setSessionInput] = useState('')
  const [claudeEmail, setClaudeEmail] = useState('')
  const [claudePassword, setClaudePassword] = useState('')
  const [claudeLoading, setClaudeLoading] = useState(false)
  const [claudeError, setClaudeError] = useState('')

  async function handleClaudeLogin() {
    if (!claudeEmail || !claudePassword) { setClaudeError('이메일과 비밀번호를 입력하세요.'); return }
    setClaudeLoading(true); setClaudeError('')
    try {
      const key = await claudeWebLogin(claudeEmail, claudePassword)
      setSessionInput(key)
    } catch (e: any) {
      setClaudeError(e.message)
    } finally {
      setClaudeLoading(false)
    }
  }

  function handleNext() {
    if (selected === 'anthropic' && anthropicKey.trim()) {
      onNext({ anthropicApiKey: anthropicKey.trim(), aiProvider: 'claude' })
    } else if (selected === 'claude-web' && sessionInput.trim()) {
      onNext({ claudeSessionKey: sessionInput.trim(), aiProvider: 'claude-web' })
    } else if (selected === 'openai' && openaiKey.trim()) {
      onNext({ openaiApiKey: openaiKey.trim(), aiProvider: 'chatgpt' })
    }
  }

  const canNext =
    (selected === 'anthropic' && !!anthropicKey.trim()) ||
    (selected === 'claude-web' && !!sessionInput.trim()) ||
    (selected === 'openai' && !!openaiKey.trim())

  const options: { id: AiMethod; label: string; desc: string; badge?: string }[] = [
    { id: 'claude-web', label: 'Claude.ai 구독', desc: 'Pro/Team 구독이 있다면 API 비용 없이 사용', badge: '추천' },
    { id: 'anthropic', label: 'Anthropic API 키', desc: 'console.anthropic.com에서 발급 ($5부터)' },
    { id: 'openai', label: 'OpenAI API 키', desc: 'ChatGPT API 키 사용' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">AI 연결</h2>
        <p className="text-sm text-gray-500 mt-1">어떤 방식으로 AI를 연결할까요?</p>
      </div>

      {/* 선택 카드 */}
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              selected === opt.id
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
              {opt.badge && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{opt.badge}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* 선택에 따른 입력 */}
      {selected === 'anthropic' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 flex items-center justify-between">
            Anthropic API 키
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline">↗ 발급하기</a>
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      )}

      {selected === 'claude-web' && (
        <div className="space-y-3">
          {sessionInput ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-green-600 text-sm">✓ 연결됨</span>
              <button type="button" onClick={() => setSessionInput('')} className="ml-auto text-xs text-red-400 hover:text-red-600">취소</button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-800">Google 계정 사용 시</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>아래 버튼으로 claude.ai 열어서 Google 로그인</li>
                  <li>F12 → Application → Cookies → https://claude.ai → sessionKey 값 복사</li>
                  <li>아래 직접 입력란에 붙여넣기</li>
                </ol>
                <button
                  type="button"
                  onClick={() => window.open('https://claude.ai', '_blank', 'noopener,noreferrer')}
                  className="w-full py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  claude.ai 열기
                </button>
              </div>

              <p className="text-xs font-medium text-gray-500 text-center">또는 이메일 계정으로 직접 로그인</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={claudeEmail} onChange={e => setClaudeEmail(e.target.value)}
                  placeholder="이메일" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400" />
                <input type="password" value={claudePassword} onChange={e => setClaudePassword(e.target.value)}
                  placeholder="비밀번호" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <button type="button" onClick={handleClaudeLogin} disabled={claudeLoading}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-xl disabled:opacity-50">
                {claudeLoading ? '로그인 중...' : 'Claude.ai 로그인'}
              </button>
              {claudeError && <p className="text-xs text-red-500">{claudeError}</p>}

              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">세션 키 직접 붙여넣기</p>
                <input
                  type="password"
                  value={sessionInput}
                  onChange={e => setSessionInput(e.target.value)}
                  placeholder="sessionKey 값..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </>
          )}
        </div>
      )}

      {selected === 'openai' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 flex items-center justify-between">
            OpenAI API 키
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline">↗ 발급하기</a>
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onBack} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
          ← 이전
        </button>
        <button
          onClick={handleNext}
          disabled={!canNext}
          className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
        >
          다음 →
        </button>
      </div>
    </div>
  )
}

function GmailStep({
  onNext, onSkip, onBack, mcpEndpoint,
}: {
  onNext: (patch: Partial<Settings>) => void
  onSkip: () => void
  onBack: () => void
  mcpEndpoint: string
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleNext() {
    if (!username.trim() || !password.trim()) { onSkip(); return }
    const id = `mail-${Date.now()}`
    onNext({
      mailAccounts: [{
        id,
        name: 'Gmail',
        provider: 'imap',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapSsl: true,
        mcpEndpoint,
        inboxTool: 'imap.inbox',
        auth: { mode: 'account-password', username: username.trim(), password: password.trim() },
      }],
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Gmail 연결 <span className="text-sm font-normal text-gray-400">(선택)</span></h2>
        <p className="text-sm text-gray-500 mt-1">Gmail 앱 비밀번호로 간단하게 연결합니다.</p>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-1.5">
        <p className="text-xs font-semibold text-amber-800">앱 비밀번호 발급 방법</p>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Google 계정 → 보안 → 2단계 인증 켜기</li>
          <li>"앱 비밀번호" 검색 → 생성 → 16자리 복사</li>
        </ol>
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-amber-700 underline mt-0.5"
        >
          ↗ 앱 비밀번호 페이지 열기
        </a>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Gmail 주소 (yourname@gmail.com)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-400"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="앱 비밀번호 (16자리)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
          ← 이전
        </button>
        <button
          onClick={handleNext}
          disabled={!username.trim() || !password.trim()}
          className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
        >
          완료 →
        </button>
      </div>
      <button onClick={onSkip} className="w-full text-sm text-gray-400 hover:text-gray-600">
        나중에 설정하기
      </button>
    </div>
  )
}

function DoneStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="text-5xl">🎉</div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">설정 완료!</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          이제 AI 브리핑, 할 일 관리, 주식 정보 등<br />
          모든 기능을 사용할 수 있습니다.
        </p>
      </div>
      <button
        onClick={onComplete}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        대시보드로 이동 →
      </button>
    </div>
  )
}
