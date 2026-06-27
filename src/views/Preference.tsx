import { useEffect, useState } from 'react'

const API = 'http://127.0.0.1:8766'

const TRAIT_DEFS = [
  { key: 'openness',          label: '개방성' },
  { key: 'conscientiousness', label: '성실성' },
  { key: 'extraversion',      label: '외향성' },
  { key: 'agreeableness',     label: '친화성' },
  { key: 'stability',         label: '정서안정성' },
]

interface AxisBlock {
  axes: string[]
  manual: number[]
  auto: number[]
  manual_set: boolean[]
  auto_set: boolean[]
  diff: (number | null)[]
}

interface MbtiAxisEvidence {
  letter: string
  confidence: number | null
  evidence: string
}

interface RadarData extends AxisBlock {
  keys: string[]
  auto_at: string
  mbti: AxisBlock & {
    manual_label: string
    auto_label: string
    evidence: (MbtiAxisEvidence | null)[]
    criteria: string[]
  }
}

interface PrefSuggestion {
  mbti_auto?: string
  personality_auto?: string
  preference_auto?: string
  [traitKey: string]: string | number | undefined
}

function RadarChart({ data, size = 280, color1 = '#6366f1', color2 = '#fb923c' }: {
  data: AxisBlock; size?: number; color1?: string; color2?: string
}) {
  const center = size / 2, maxR = size / 2 - 36
  const n = data.axes.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (i: number, val: number): [number, number] => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * maxR
    return [center + r * Math.cos(angle(i)), center + r * Math.sin(angle(i))]
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ')
  const uid = data.axes.join('-')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full mx-auto select-none" style={{ maxWidth: size }}>
      <defs>
        <radialGradient id={`grad1-${uid}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={color1} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color1} stopOpacity={0.08} />
        </radialGradient>
        <radialGradient id={`grad2-${uid}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={color2} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color2} stopOpacity={0.06} />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* 배경 동심 다각형 (그라데이션 느낌의 미세한 톤 차이) */}
      {[100, 75, 50, 25].map((r, idx) => (
        <polygon key={r}
          points={Array.from({ length: n }, (_, i) => pt(i, r).join(',')).join(' ')}
          fill={idx % 2 === 0 ? '#f8fafc' : 'transparent'}
          stroke="#e2e8f0" strokeWidth={1} strokeDasharray={r === 100 ? undefined : '3,3'} />
      ))}

      {/* 축 선 (정중앙 위로 뻗는 세로축 선은 생략) */}
      {Array.from({ length: n }, (_, i) => {
        if (i === 0) return null
        const [x, y] = pt(i, 100)
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />
      })}

      {/* 50점 기준선 라벨 */}
      <text x={center + 4} y={center - (maxR * 0.5) - 2} fontSize={9} fill="#cbd5e1">50</text>
      <text x={center + 4} y={center - maxR - 2} fontSize={9} fill="#cbd5e1">100</text>

      {/* 직접입력 폴리곤 */}
      {data.manual_set.some(Boolean) && (
        <g filter={`url(#glow-${uid})`}>
          <polygon points={poly(data.manual)} fill={`url(#grad1-${uid})`} stroke={color1} strokeWidth={2.5} strokeLinejoin="round" />
          {data.manual.map((v, i) => {
            if (!data.manual_set[i]) return null
            const [x, y] = pt(i, v)
            return <circle key={i} cx={x} cy={y} r={4} fill={color1} stroke="white" strokeWidth={1.5} />
          })}
        </g>
      )}

      {/* 자동측정 폴리곤 */}
      {data.auto_set.some(Boolean) && (
        <g filter={`url(#glow-${uid})`}>
          <polygon points={poly(data.auto)} fill={`url(#grad2-${uid})`} stroke={color2} strokeWidth={2.5} strokeDasharray="6,4" strokeLinejoin="round" />
          {data.auto.map((v, i) => {
            if (!data.auto_set[i]) return null
            const [x, y] = pt(i, v)
            return <circle key={i} cx={x} cy={y} r={4} fill={color2} stroke="white" strokeWidth={1.5} />
          })}
        </g>
      )}

      {/* 축 라벨 */}
      {data.axes.map((label, i) => {
        const [x, y] = pt(i, 122)
        return (
          <text key={label} x={x} y={y} fontSize={12} fontWeight={600} fill="#475569" textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

function DiffList({ data }: { data: AxisBlock }) {
  return (
    <ul className="space-y-1.5">
      {data.axes.map((label, i) => {
        const m = data.manual_set[i] ? data.manual[i] : null
        const a = data.auto_set[i] ? data.auto[i] : null
        const d = data.diff[i]
        const tone = d === null ? 'bg-gray-200' : d >= 25 ? 'bg-red-400' : d >= 10 ? 'bg-amber-400' : 'bg-emerald-400'
        return (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-gray-500 font-medium">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 relative overflow-hidden">
              {m !== null && <div className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full" style={{ width: `${m}%` }} />}
              {a !== null && <div className="absolute top-0 h-1.5 w-0.5 bg-orange-500" style={{ left: `${a}%` }} />}
            </div>
            <span className="w-[88px] shrink-0 text-right text-gray-400">
              {m !== null ? m : '–'} / {a !== null ? a : '–'}
              {d !== null && (
                <span className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${tone}`} title={`차이 ${d}`} />
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function Preference() {
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [radar, setRadar] = useState<RadarData | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<{
    ready: boolean
    count?: number
    message?: string
    suggestion?: PrefSuggestion
    reason?: string
  } | null>(null)
  const [applyMsg, setApplyMsg] = useState('')

  const fetchProfile = () => {
    fetch(`${API}/profile/me`).then(r => r.json()).then(d => {
      const flat: Record<string, string> = {}
      Object.entries(d.profile || {}).forEach(([k, v]: any) => { flat[k] = v.value || '' })
      setProfile(flat)
    }).catch(() => {})
  }
  const fetchRadar = () => {
    fetch(`${API}/preference/radar`).then(r => r.json()).then(setRadar).catch(() => {})
  }
  useEffect(() => { fetchProfile(); fetchRadar() }, [])

  const saveProfile = async () => {
    try {
      await fetch(`${API}/profile/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      setSaveMsg('저장됐습니다')
      fetchRadar()
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('저장 실패') }
  }

  const analyze = async () => {
    setAnalyzing(true)
    setResult(null)
    setApplyMsg('')
    try {
      const res = await fetch(`${API}/preference/analyze`)
      setResult(await res.json())
    } catch {
      setResult({ ready: false, message: '분석 실패' })
    } finally {
      setAnalyzing(false)
    }
  }

  const applySuggestion = async () => {
    if (!result?.suggestion) return
    try {
      const res = await fetch(`${API}/preference/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.suggestion),
      })
      const data = await res.json()
      const flat: Record<string, string> = {}
      Object.entries(data.profile || {}).forEach(([k, v]: any) => { flat[k] = v.value || '' })
      setProfile(p => ({ ...p, ...flat }))
      fetchRadar()
      setApplyMsg('적용됐습니다')
      setTimeout(() => setApplyMsg(''), 2000)
    } catch {
      setApplyMsg('적용 실패')
    }
  }

  const inputCls = "w-full border border-surface-border rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
  const labelCls = "text-xs font-medium text-gray-600"

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-base font-semibold text-gray-900">성향 (MBTI/성격/선호도)</h2>
      <p className="text-xs text-gray-400 mt-1 mb-6 max-w-lg">
        직접 입력한 값은 항상 우선 반영되고, mental-avatar 채팅 답변에도 함께 쓰입니다.
        비워두면 AI 자동측정 결과가 대신 쓰입니다.
      </p>

      <div className="flex gap-8 items-start flex-wrap">
        <div className="flex-1 min-w-[320px] max-w-lg space-y-6">

          <div className="space-y-3">
            <div className="space-y-1">
              <label className={labelCls}>MBTI (직접 입력)</label>
              <input value={profile.mbti_manual || ''} onChange={e => setProfile(p => ({ ...p, mbti_manual: e.target.value }))}
                className={inputCls} placeholder="예: INTJ" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>성격 (직접 입력)</label>
              <textarea value={profile.personality_manual || ''} onChange={e => setProfile(p => ({ ...p, personality_manual: e.target.value }))}
                className={inputCls} rows={2} placeholder="예: 분석적이고 끝까지 파고드는 편" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>선호도/가치관 (직접 입력)</label>
              <textarea value={profile.preference_manual || ''} onChange={e => setProfile(p => ({ ...p, preference_manual: e.target.value }))}
                className={inputCls} rows={2} placeholder="예: 효율과 정확성을 우선시함" />
            </div>

            <div className="space-y-2">
              <label className={labelCls}>Big Five 성향 (직접 입력, 0~100)</label>
              {TRAIT_DEFS.map(({ key, label }) => {
                const fieldKey = `trait_${key}_manual`
                const val = profile[fieldKey] !== undefined && profile[fieldKey] !== '' ? Number(profile[fieldKey]) : 50
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-16 shrink-0">{label}</span>
                    <input type="range" min={0} max={100} value={val}
                      onChange={e => setProfile(p => ({ ...p, [fieldKey]: e.target.value }))}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-8 text-right">{val}</span>
                  </div>
                )
              })}
            </div>

            <div className="space-y-1">
              <label className={labelCls}>자동측정 주기</label>
              <div className="flex flex-wrap gap-2">
                {['1', '3', '7', '14', '30'].map(d => (
                  <button key={d} onClick={() => setProfile(p => ({ ...p, preference_interval_days: d }))}
                    className={`px-3 py-1.5 text-xs rounded-full border transition ${
                      (profile.preference_interval_days || '7') === d
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-surface-border text-gray-600 hover:border-gray-400'
                    }`}>{d}일</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={saveProfile}
            className="w-full py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-700 transition">
            저장
          </button>
          {saveMsg && <p className={`text-xs text-center ${saveMsg.includes('저장됐') ? 'text-green-600' : 'text-red-500'}`}>{saveMsg}</p>}

          <button onClick={analyze} disabled={analyzing}
            className="w-full py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-40 transition">
            {analyzing ? '분석 중…' : '지금 자동측정 실행'}
          </button>

          {result && !result.ready && (
            <p className="text-xs text-gray-400">{result.message}</p>
          )}

          {result?.ready && result.suggestion && (
            <div className="p-3 bg-gray-50 border border-surface-border rounded-xl space-y-2 text-xs text-gray-600">
              <p className="text-gray-400">최근 대화 {result.count}개 + 지식그래프 토픽 분석 결과</p>
              <ul className="space-y-1">
                {result.suggestion.mbti_auto && <li>MBTI: <span className="font-medium text-gray-900">{result.suggestion.mbti_auto}</span></li>}
                {result.suggestion.personality_auto && <li>성격: <span className="font-medium text-gray-900">{result.suggestion.personality_auto}</span></li>}
                {result.suggestion.preference_auto && <li>선호도: <span className="font-medium text-gray-900">{result.suggestion.preference_auto}</span></li>}
                {TRAIT_DEFS.map(({ key, label }) => {
                  const v = result.suggestion?.[`trait_${key}_auto`]
                  return v !== undefined ? (
                    <li key={key}>{label}: <span className="font-medium text-gray-900">{v}점</span></li>
                  ) : null
                })}
              </ul>
              {result.reason && <p className="text-gray-400">{result.reason}</p>}
              <button onClick={applySuggestion}
                className="w-full py-1.5 rounded-xl bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition">
                프로파일에 적용
              </button>
              {applyMsg && <p className={`text-xs text-center ${applyMsg.includes('적용됐') ? 'text-green-600' : 'text-red-500'}`}>{applyMsg}</p>}
            </div>
          )}

          {profile.preference_auto_at && (
            <p className="text-xs text-gray-400">마지막 자동측정: {profile.preference_auto_at}</p>
          )}
        </div>

        {radar && (
          <div className="flex-1 min-w-[340px] max-w-md space-y-5 sticky top-6">

            {/* Big Five 카드 */}
            <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-orange-50 border-b border-surface-border">
                <p className="text-sm font-semibold text-gray-800">Big Five 성향 비교</p>
                <p className="text-[11px] text-gray-400 mt-0.5">직접입력과 AI 자동측정을 한눈에</p>
              </div>
              <div className="p-5">
                <RadarChart data={radar} size={300} />
                <div className="flex justify-center gap-5 text-xs mt-1 mb-4">
                  <span className="flex items-center gap-1.5 text-indigo-600 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />직접입력</span>
                  <span className="flex items-center gap-1.5 text-orange-500 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />자동측정</span>
                </div>
                <DiffList data={radar} />
              </div>
            </div>

            {/* MBTI 카드 */}
            <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-orange-50 border-b border-surface-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">MBTI 비교</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">4축(E-I·S-N·T-F·J-P) 기준</p>
                </div>
                <div className="flex gap-1.5 text-xs font-semibold">
                  <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700">{radar.mbti.manual_label || '미입력'}</span>
                  <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-600">{radar.mbti.auto_label || '미측정'}</span>
                </div>
              </div>
              <div className="p-5">
                <RadarChart data={radar.mbti} size={260} />
                <div className="mt-2">
                  <DiffList data={radar.mbti} />
                </div>

                {radar.mbti.evidence.some(Boolean) && (
                  <div className="mt-4 pt-4 border-t border-surface-border space-y-2.5">
                    <p className="text-xs font-medium text-gray-600">AI는 이렇게 판단했습니다 (판별 기준 대비 근거)</p>
                    {radar.mbti.axes.map((label, i) => {
                      const ev = radar.mbti.evidence[i]
                      if (!ev) return null
                      const conf = ev.confidence ?? null
                      const confTone = conf === null ? 'bg-gray-100 text-gray-500'
                        : conf >= 70 ? 'bg-emerald-100 text-emerald-700'
                        : conf >= 40 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-600'
                      return (
                        <div key={label} className="rounded-xl bg-gray-50 border border-surface-border p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">{label} → <span className="text-orange-600">{ev.letter}</span></span>
                            {conf !== null && (
                              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${confTone}`}>확신도 {conf}%</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 leading-snug">{radar.mbti.criteria[i]}</p>
                          {ev.evidence && (
                            <p className="text-xs text-gray-700 leading-snug">"{ev.evidence}"</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
