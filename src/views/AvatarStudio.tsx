import { useState, useRef, useEffect } from 'react'

const API = 'http://127.0.0.1:8766'

export default function AvatarStudio() {
  const [faceFile, setFaceFile]               = useState<File | null>(null)
  const [facePreview, setFacePreview]         = useState<string | null>(null)
  const [text, setText]                       = useState('')
  const [voiceRegistered, setVoiceRegistered] = useState(false)
  const [videoUrl, setVideoUrl]               = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [status, setStatus]                   = useState('')
  const faceInputRef  = useRef<HTMLInputElement>(null)
  const voiceInputRef = useRef<HTMLInputElement>(null)

  // 목소리 등록 여부 확인 (서버에 voice_sample.wav 존재 여부)
  useEffect(() => {
    fetch(`${API}/avatar/voice_status`)
      .then(r => r.json())
      .then(d => setVoiceRegistered(d.registered ?? false))
      .catch(() => {})
  }, [])

  const onFaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFaceFile(f)
    setFacePreview(URL.createObjectURL(f))
  }

  const onVoiceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    const form = new FormData()
    form.append('sample', f)
    setError(null)
    try {
      const res = await fetch(`${API}/avatar/register_voice`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setVoiceRegistered(true)
        setStatus(`목소리 등록 완료 (${data.duration}초)`)
      } else {
        setError(data.error)
      }
    } catch {
      setError('목소리 등록 실패')
    }
  }

  const canGenerate = !!faceFile && !!text.trim() && voiceRegistered && !loading

  const handleGenerate = async () => {
    if (!canGenerate || !faceFile) return
    setLoading(true)
    setError(null)
    setVideoUrl(null)

    const form = new FormData()
    form.append('face', faceFile)
    form.append('text', text)

    try {
      setStatus('TTS 음성 생성 + 립싱크 영상 합성 중… (30초~2분 소요)')
      const res = await fetch(`${API}/avatar/tts_generate`, { method: 'POST', body: form })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      setVideoUrl(URL.createObjectURL(blob))
      setStatus('완료')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">아바타 스튜디오</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* 얼굴 사진 */}
        <div
          onClick={() => faceInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gray-400 transition-colors min-h-[160px]"
        >
          {facePreview
            ? <img src={facePreview} alt="얼굴" className="w-20 h-20 rounded-full object-cover" />
            : <span className="text-4xl text-gray-300">◉</span>
          }
          <span className="text-xs text-gray-500 text-center whitespace-pre-line">
            {faceFile ? faceFile.name : '얼굴 사진 업로드\n(jpg/png)'}
          </span>
          <input ref={faceInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFaceChange} />
        </div>

        {/* 목소리 샘플 */}
        <div
          onClick={() => voiceInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gray-400 transition-colors min-h-[160px]"
        >
          <span className={`text-3xl ${voiceRegistered ? 'text-green-500' : 'text-gray-300'}`}>
            {voiceRegistered ? '✓' : '♪'}
          </span>
          <span className="text-xs text-gray-500 text-center whitespace-pre-line">
            {voiceRegistered
              ? '목소리 등록됨\n(재업로드 가능)'
              : '내 목소리 샘플 등록\n(wav, 6~30초)'}
          </span>
          <input ref={voiceInputRef} type="file" accept="audio/wav" className="hidden" onChange={onVoiceChange} />
        </div>
      </div>

      {/* 텍스트 입력 */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="아바타가 할 말을 입력하세요…"
        rows={4}
        className="w-full border border-gray-200 rounded-2xl p-4 text-sm text-gray-900 resize-none focus:outline-none focus:border-gray-400 mb-4"
      />

      {/* 생성 버튼 */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`
          w-full py-3 rounded-2xl text-sm font-semibold transition-all mb-2
          ${canGenerate
            ? 'bg-gray-900 text-white hover:bg-gray-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
        `}
      >
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {status || '처리 중…'}
            </span>
          : '영상 생성'}
      </button>

      {!voiceRegistered && (
        <p className="text-xs text-amber-600 text-center mb-2">목소리 샘플을 먼저 등록해주세요</p>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-50 text-red-600 text-sm rounded-xl break-words">{error}</div>
      )}

      {videoUrl && (
        <div className="mt-6">
          <video src={videoUrl} controls autoPlay className="w-full rounded-2xl shadow-md" />
          <div className="flex justify-center mt-3">
            <a
              href={videoUrl}
              download="avatar.mp4"
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors"
            >
              다운로드
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
