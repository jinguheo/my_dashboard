/**
 * Avatar3DStudio ???¤ìê°?3D ?ë°? (mental-avatar??Avatar3DChatê³??ì¼ ê¸°ë¥)
 * - FaceTrackingPanel: ?¹ìº  ??MediaPipe ?¼êµ´ì¶ì  ??3D ë©ì ?ì¤ì²?ë§¤í + ?ì /ê³ ê° ì¶ì¶
 * - 3D ?ë°?: ?¬ì©???ì /ê³ ê°ë¥??°ë¼ êµ¬ë, TTS ì¤ì ë¦½ì±?¬ë¡ ?í
 * - AI ??? ?¤ì ??aiProvider(ê¸°ë³¸ Ollama)???°ë¼ ?°ê²°, ?ëµ??TTSë¡??¬ì
 * - VAD ê¸°ë° ?ë STT
 */
import { useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import * as THREE from 'three'
import ChatMarkdown from '@/components/ChatMarkdown'
import { streamClaudeWeb } from '@/services/claudeWeb'
import { streamChatOpenAI } from '@/services/openai'
import { streamChat } from '@/services/claude'
import FaceTrackingPanel from './FaceTrackingPanel'
import type { Settings } from '@/types'

const API = 'http://127.0.0.1:8766'
const TTS_API = 'http://127.0.0.1:8767'
const OLLAMA_ENDPOINT = 'http://localhost:11434/v1'
const OLLAMA_MODEL = 'gemma4:e2b'

const GREETING = '안녕하세요. 반갑습니다. 무엇이든 안내해드릴게요.'

export interface ChatMsg { role: 'user' | 'assistant'; content: string; source?: 'typed' | 'stt' }
interface Props {
  settings: Settings
  messages: ChatMsg[]
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>
}

// ?? 3D ?ë°? ?¸í ?¤í????ë³´êµ???
interface AvatarStyle {
  id: string
  label: string
  skin: number
  hair: number
  shirt: number
  hairStyle: 'long' | 'short' | 'bald'
  glasses: boolean
}
const AVATAR_STYLES: AvatarStyle[] = [
  { id: 'classic',  label: 'Classic', skin: 0xf2c4a0, hair: 0x1a1008, shirt: 0x1e3a5f, hairStyle: 'long',  glasses: false },
  { id: 'short',    label: 'Short',   skin: 0xead2b4, hair: 0x3b2a1a, shirt: 0x44474f, hairStyle: 'short', glasses: false },
  { id: 'glasses',  label: 'Glasses', skin: 0xf2c4a0, hair: 0x6b4423, shirt: 0x2f6f6a, hairStyle: 'long',  glasses: true  },
  { id: 'blonde',   label: 'Blonde',  skin: 0xf5d2b0, hair: 0xcaa86a, shirt: 0x6b2737, hairStyle: 'bald',  glasses: false },
]
const AVATAR_STYLE_KEY = 'mental-avatar-3d-style'

// ?? ëª©ìë¦??ë³´êµ? '??ëª©ìë¦?(XTTS ?´ë¡?? + ?ë² ?ê³µ ?íë¦??ì/?´ë¦°???? + ë¸ë¼?°ì? ?´ì¥ TTS ëª©ìë¦¬ë¤ ??
interface VoiceOption { id: string; label: string; kind: 'clone' | 'template' | 'system'; voiceURI?: string }
const MY_VOICE: VoiceOption = { id: 'mine', label: 'Mine', kind: 'clone' }
// ë°±ì??VOICE_TEMPLATES? idë¥?ë§ì¶°????(mental-avatar/api/server.py)
const TEMPLATE_VOICES: VoiceOption[] = [
  { id: 'pretty', label: 'Pretty', kind: 'template' },
  { id: 'child',  label: 'Child',  kind: 'template' },
  { id: 'calm',   label: 'Calm',   kind: 'template' },
  { id: 'bright', label: 'Bright', kind: 'template' },
]
const VOICE_OPTION_KEY = 'mental-avatar-3d-voice'
const SPLIT_RATIO_KEY = 'mental-avatar-3d-split'

export default function Avatar3DStudio({ settings, messages, setMessages }: Props) {
  const [avatarStyleId, setAvatarStyleId] = useState<string>(() => {
    try { return localStorage.getItem(AVATAR_STYLE_KEY) || AVATAR_STYLES[0].id } catch { return AVATAR_STYLES[0].id }
  })
  const avatarStyle = AVATAR_STYLES.find(s => s.id === avatarStyleId) || AVATAR_STYLES[0]
  const selectAvatarStyle = (id: string) => {
    setAvatarStyleId(id)
    try { localStorage.setItem(AVATAR_STYLE_KEY, id) } catch { /* ignore */ }
  }

  // ëª©ìë¦?? í ??'??ëª©ìë¦?(XTTS ?´ë¡?? ?ë ë¸ë¼?°ì? ?´ì¥ TTS???¤ë¥¸ ëª©ìë¦¬ë¤ ì¤?? í
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const load = () => {
      const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ko') || v.lang.startsWith('en'))
      if (voices.length) setSystemVoices(voices.slice(0, 6))
    }
    load()
    speechSynthesis.onvoiceschanged = load
    return () => { speechSynthesis.onvoiceschanged = null }
  }, [])
  const voiceOptions: VoiceOption[] = [
    MY_VOICE,
    ...TEMPLATE_VOICES,
    ...systemVoices.map(v => ({ id: `sys:${v.voiceURI}`, label: v.name, kind: 'system' as const, voiceURI: v.voiceURI })),
  ]
  const [voiceOptionId, setVoiceOptionId] = useState<string>(() => {
    try { return localStorage.getItem(VOICE_OPTION_KEY) || MY_VOICE.id } catch { return MY_VOICE.id }
  })
  const selectedVoice = voiceOptions.find(v => v.id === voiceOptionId) || MY_VOICE
  const selectVoiceOption = (id: string) => {
    setVoiceOptionId(id)
    try { localStorage.setItem(VOICE_OPTION_KEY, id) } catch { /* ignore */ }
  }
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_RATIO_KEY))
      return Number.isFinite(saved) ? Math.min(72, Math.max(28, saved)) : 50
    } catch {
      return 50
    }
  })
  const splitRatioRef = useRef(splitRatio)
  const workspaceRef = useRef<HTMLDivElement>(null)
  useEffect(() => { splitRatioRef.current = splitRatio }, [splitRatio])
  useEffect(() => {
    try { localStorage.setItem(SPLIT_RATIO_KEY, String(splitRatio)) } catch { /* ignore */ }
  }, [splitRatio])

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const clockRef   = useRef(new THREE.Clock())
  const rafRef     = useRef(0)

  // ?ë°? ?í¸
  const groupRef   = useRef<THREE.Group | null>(null)
  const jawRef     = useRef<THREE.Mesh | null>(null)
  const lipUpRef   = useRef<THREE.Mesh | null>(null)
  const lipDnRef   = useRef<THREE.Mesh | null>(null)
  const armLRef    = useRef<THREE.Group | null>(null)
  const armRRef    = useRef<THREE.Group | null>(null)
  const browLRef   = useRef<THREE.Mesh | null>(null)
  const browRRef   = useRef<THREE.Mesh | null>(null)
  const lidLRef    = useRef<THREE.Mesh | null>(null)
  const lidRRef    = useRef<THREE.Mesh | null>(null)
  const eyeGpLRef  = useRef<THREE.Group | null>(null)
  const eyeGpRRef  = useRef<THREE.Group | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // ?¹ìº  ?¼êµ´ ì¶ì  ??FaceTrackingPanel??ë§??ë ???ë¬?ë ?ì (ë¸ë ?ì°?´í) ?ì.
  // ê°ì´ ?¤ì´?¤ë©´(?¹ìº  ON) 3D ?ë°? ?ì ???¬ì©???¼êµ´??ë§ì¶° êµ¬ë?ë¤.
  const faceBlendRef = useRef<Record<string, number> | null>(null)
  const handleFaceBlendshapes = useCallback((scores: Record<string, number> | null) => {
    faceBlendRef.current = scores
  }, [])
  const headPoseRef = useRef<{ pitch: number; yaw: number; roll: number } | null>(null)
  const handleHeadPose = useCallback((pose: { pitch: number; yaw: number; roll: number } | null) => {
    headPoseRef.current = pose
  }, [])
  const handGestureRef = useRef<string | null>(null)
  const handleHandGesture = useCallback((gesture: string | null) => {
    handGestureRef.current = gesture
  }, [])

  // ë¸ë¼?°ì? ?ë?¬ì ?ì± ??AudioContext???¬ì©???ì¤ì²??ì´??'suspended' ?íë¡??ì???ë¦¬ê° ????
  // ?ì´ì§ ì²??´ë¦­/?¤ì???°ì¹?ì ë¯¸ë¦¬ ?ì±Â·resume ???ë¤ (?ë ?¸ì¬ ê°ì? ë¬´ì ?¤ì² ?¬ì???¤ë¦¬?ë¡).
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // ì±í
  const [input, setInput]             = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [speaking, setSpeaking]       = useState(false)
  const speakingRef = useRef(false)   // ?ë°?ê° ë§í??ì¤?(?¼ëë°?ë£¨í ë°©ì???
  const sttBusyRef  = useRef(false)   // STT ì²ë¦¬ ì¤?(?ì²­ ì¤ë³µ ë°©ì???
  const chatEndRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef<(overrideText?: string) => void>(() => {})
  const sttEchoRef = useRef<string | null>(null)

  // ?ì± ?¸ì(STT) ??VAD(?ì± ê°ì?) ê¸°ë° ?ë ?¹ì: ??ë²??ë¥´ë©?ë§íê¸??ì/?ì ?ë?¼ë¡ ê°ì?
  const [recording, setRecording] = useState(false)   // ?£ê¸° ëª¨ë on/off (ë§ì´??ì¼ì§)
  const [vadActive, setVadActive] = useState(false)   // ?ì¬ ?ì±??ê°ì??ì´ ?¹ì ì¤ì¸ì§
  const [micLevel, setMicLevel]   = useState(0)       // ?ì¬ ë§ì´???ë ¥ ?ë²¨ (ì§ë¨/?ì??
  const [sttBusy, setSttBusy]     = useState(false)
  const [sttResult, setSttResult] = useState<{ text: string; language?: string } | null>(null)
  const [sttError, setSttError]   = useState('')
  const sttStreamRef = useRef<MediaStream | null>(null)
  const sttCtxRef    = useRef<AudioContext | null>(null)
  const sttRecRef    = useRef<MediaRecorder | null>(null)
  const sttChunksRef = useRef<Blob[]>([])
  const sttSilenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sttListeningRef = useRef(false)

  // ?¤ì ??aiProvider(ê¸°ë³¸ê°?ollama)???°ë¼ AI ????°ê²°
  const aiProvider = settings.aiProvider ?? 'ollama'
  const hasAiConnection = aiProvider === 'ollama' || !!(settings.anthropicApiKey || settings.claudeSessionKey || settings.openaiApiKey || settings.customAiEndpoint)
  const providerLabel = aiProvider === 'ollama' ? 'Ollama (로컬)'
    : aiProvider === 'claude-web' ? 'Claude.ai'
      : aiProvider === 'claude' ? 'Claude API'
        : aiProvider === 'chatgpt' ? 'ChatGPT'
          : 'Custom AI'

  const callAvatarAI = useCallback(async (
    history: ChatMsg[],
    system: string,
    onDelta: (text: string) => void,
  ) => {
    if (aiProvider === 'claude-web') {
      return streamClaudeWeb(settings.claudeSessionKey, settings.mcpEndpoint, history, system, onDelta)
    } else if (aiProvider === 'claude') {
      return streamChat(settings.anthropicApiKey, history, system, onDelta)
    } else if (aiProvider === 'chatgpt') {
      return streamChatOpenAI(settings.openaiApiKey, 'https://api.openai.com/v1', 'gpt-4o', history, system, onDelta)
    } else if (aiProvider === 'custom') {
      return streamChatOpenAI('', settings.customAiEndpoint, settings.customAiModel || 'gpt-4o', history, system, onDelta)
    }
    return streamChatOpenAI('', OLLAMA_ENDPOINT, OLLAMA_MODEL, history, system, onDelta)
  }, [aiProvider, settings])

  // ?? TTS ????????????????????????????????????????????????
  const playTTS = useCallback(async (text: string) => {
    setSpeaking(true); speakingRef.current = true
    const voice = selectedVoice
    // done? ??ë²ë§ ?¤í + failsafe ??´ë¨¸ ?´ì . TTSê° ?´ë¤ ê²½ë¡ë¡??¤í¨?ë (ë¸ë¼?°ì? ?ì± ë¬´ì??
    // play ê±°ë? ?? speaking ?ëê·¸ê? ?êµ¬??ë°í? ë§ì´?¬ê? ë§í???¼ì ë§ë??
    let finished = false
    const failsafe = setTimeout(() => done(), 2000 + text.length * 200)  // ê¸?ì ê¸°ë° ìµë? ?¬ì?ê° ì¶ì 
    const done = () => {
      if (finished) return
      finished = true
      clearTimeout(failsafe)
      setSpeaking(false); speakingRef.current = false
    }

    const speakBrowserFallback = () => {
      if (typeof speechSynthesis === 'undefined') {
        done()
        return
      }
      const u = new SpeechSynthesisUtterance(text)
      const voices = speechSynthesis.getVoices()
      const preferredVoice =
        voices.find(v => v.lang?.toLowerCase().startsWith('ko')) ||
        voices.find(v => v.default) ||
        voices[0]
      if (preferredVoice) u.voice = preferredVoice
      u.lang = preferredVoice?.lang || 'ko-KR'
      u.rate = 0.95
      u.pitch = 1
      u.volume = 1
      u.onend = done
      u.onerror = done
      try { speechSynthesis.cancel(); speechSynthesis.resume() } catch { /* ignore */ }
      if (!voices.length) {
        window.setTimeout(() => {
          try { speechSynthesis.speak(u) } catch { done() }
        }, 200)
        return
      }
      try { speechSynthesis.speak(u) } catch { done() }
    }

    // ?ì¤??ëª©ìë¦?? í ????ë¸ë¼?°ì? ?´ì¥ TTSë¡?ì§ì  ?¬ì (XTTS ?¸ì¶ ?ëµ)
    if (voice.kind === 'system') {
      if (typeof speechSynthesis === 'undefined') {
        speakBrowserFallback()
        return
      }
      const u = new SpeechSynthesisUtterance(text)
      const matched = systemVoices.find(v => v.voiceURI === voice.voiceURI)
      if (matched) u.voice = matched
      u.lang = matched?.lang || 'ko-KR'
      u.rate = 0.95
      u.pitch = 1
      u.volume = 1
      u.onend = done
      u.onerror = done
      try { speechSynthesis.cancel(); speechSynthesis.resume() } catch { /* ignore */ }
      speechSynthesis.speak(u)
      return
    }

    try {
      const form = new FormData(); form.append('text', text)
      form.append('voice', voice.kind === 'template' ? voice.id : 'mine')
      const res = await fetch(`${TTS_API}/avatar/tts_only`, { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* ignore */ } }
      const analyser = ctx.createAnalyser(); analyser.fftSize = 64
      analyserRef.current = analyser
      const src = ctx.createMediaElementSource(audio)
      src.connect(analyser); analyser.connect(ctx.destination)
      const cleanup = () => { done(); analyserRef.current = null; URL.revokeObjectURL(url) }
      audio.onended = cleanup
      audio.onerror = cleanup
      // play()이 자동재생 정책에 막혀 reject되면 onended가 안 불려 speaking 상태가 복구되지 않을 수 있음
      try {
        await audio.play()
      } catch {
        cleanup()
        speakBrowserFallback()
      }
    } catch {
      // fallback: 브라우저 내장 TTS
      if (typeof speechSynthesis !== 'undefined') {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1; u.volume = 1
        u.onend = done
        u.onerror = done
        try { speechSynthesis.cancel(); speechSynthesis.resume() } catch { /* ignore */ }
        speechSynthesis.speak(u)
        done()
      }
    }
  }, [selectedVoice, systemVoices])

  const respond = useCallback((text: string) => { playTTS(text) }, [playTTS])

  // ?? ?ì± ?¸ì(STT) ??VADë¡?ë§íê¸??ì/?ì ?ë ê°ì????¹ìÂ·?ì¡ ??
  const THRESHOLD   = 20   // ?ì± ê°ì? ?ê³ê°?(0-255)
  const SILENCE_MS  = 1200 // ???ê°ë§í¼ ì¡°ì©?ë©´ "ë§íê¸????¼ë¡ ?ë¨

  const transcribeChunk = useCallback(async (chunks: Blob[]) => {
    if (!chunks.length) return
    const blob = new Blob(chunks, { type: 'audio/webm' })
    if (!blob.size) return
    setSttBusy(true); sttBusyRef.current = true
    try {
      const form = new FormData()
      form.append('audio', blob, 'stt.webm')
      // ??ì??20ì´? ???ë²ê° ?ë¦¬ê±°ë ë©ì¶°??"ì²ë¦¬ ì¤????êµ¬??ê°íì§ ?ê²
      const res = await fetch(`${API}/stt/transcribe`, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) })
      const data = await res.json()
      if (data.error) {
        setSttError(data.error)
      } else {
        const text = (data.text || '').trim()
        setSttResult({ text, language: data.language })
        if (text) {
          sttEchoRef.current = text
          setMessages(prev => [...prev, { role: 'user', content: text, source: 'stt' }])
          sendMessageRef.current(text)   // ?¸ì ?ëë©??ë?¼ë¡ ????ì¡
        }
      }
    } catch {
      setSttError('?¸ì ?ì²­ ?¤í¨ ??API ?ë² ?°ê²°???ì¸?´ì£¼?¸ì')
    } finally {
      setSttBusy(false); sttBusyRef.current = false
    }
  }, [])

  const stopStt = useCallback(() => {
    sttListeningRef.current = false
    if (sttSilenceTimer.current) { clearTimeout(sttSilenceTimer.current); sttSilenceTimer.current = null }
    sttRecRef.current?.stop()
    sttRecRef.current = null
    sttCtxRef.current?.close()
    sttCtxRef.current = null
    sttStreamRef.current?.getTracks().forEach(t => t.stop())
    sttStreamRef.current = null
    setRecording(false); setVadActive(false)
  }, [])

  const startStt = useCallback(async () => {
    if (recording) { stopStt(); return }
    setSttError(''); setSttResult(null)
    sttBusyRef.current = false   // ?¹ì ë°í??ì ???ë ì²ë¦¬ì¤??ëê·?ì´ê¸°??(?ì ?¥ì¹)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setSttError('ë§ì´???ê·¼ ?¤í¨: ' + (e instanceof Error ? e.message : String(e)))
      return
    }
    sttStreamRef.current = stream
    sttListeningRef.current = true
    setRecording(true)

    const ctx = new AudioContext()
    sttCtxRef.current = ctx
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* ignore */ } }
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512
    src.connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)

    let isRecording = false
    let frame = 0
    const tick = () => {
      if (!sttListeningRef.current) return
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      if ((frame++ & 7) === 0) setMicLevel(Math.round(avg))   // ì§ë¨??ë§ì´???ë²¨ ?ì(8?ë ?ë§??

      // ?ë°?ê° ë§í??ì¤ì´ê±°ë ì§ì  ?¸ì???ì§ ì²ë¦¬ ì¤ì´ë©????¹ì???ì?ì? ?ë??      // (?ë°? ëª©ìë¦¬ë? ?¤ì ?¹ì?ì¸?â?ì¡?ë ?¼ëë°?ë£¨í + ?ì²­ ??£¼ ë°©ì?)
      if ((speakingRef.current || sttBusyRef.current) && !isRecording) {
        requestAnimationFrame(tick); return
      }

      if (avg > THRESHOLD) {
        setVadActive(true)
        if (sttSilenceTimer.current) { clearTimeout(sttSilenceTimer.current); sttSilenceTimer.current = null }
        if (!isRecording) {
          isRecording = true
          sttChunksRef.current = []
          const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
          rec.ondataavailable = e => { if (e.data.size > 0) sttChunksRef.current.push(e.data) }
          rec.onstop = () => {
            isRecording = false; setVadActive(false)
            transcribeChunk([...sttChunksRef.current])
          }
          rec.start(); sttRecRef.current = rec
        }
        sttSilenceTimer.current = setTimeout(() => {
          sttRecRef.current?.stop(); sttRecRef.current = null
          setVadActive(false)
        }, SILENCE_MS)
      }
      requestAnimationFrame(tick)
    }
    tick()
  }, [recording, stopStt, transcribeChunk])

  // ?? ??ì´ê¸°?????????????????????????????????????????????
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth  || 640
    const h = canvas.clientHeight || 640

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(w, h, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    rendererRef.current = renderer

    const scene = new THREE.Scene()

    // ê·¸ë¼?ì¸??ë°°ê²½
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = 4; bgCanvas.height = 256
    const bctx = bgCanvas.getContext('2d')!
    const grad = bctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#0d1b2a')
    grad.addColorStop(1, '#1a0a2e')
    bctx.fillStyle = grad; bctx.fillRect(0, 0, 4, 256)
    scene.background = new THREE.CanvasTexture(bgCanvas)

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100)
    camera.position.set(0, 0.1, 3.2)
    cameraRef.current = camera

    // ?? ì¡°ëª ??
    scene.add(new THREE.AmbientLight(0x445566, 0.8))
    const key = new THREE.DirectionalLight(0xfff8f0, 3)
    key.position.set(1.2, 2.5, 2.5); key.castShadow = true
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8899cc, 1.2)
    fill.position.set(-2, 0, 1); scene.add(fill)
    const rim = new THREE.DirectionalLight(0x6644ff, 0.8)
    rim.position.set(0, -1, -3); scene.add(rim)
    const top = new THREE.PointLight(0xffffff, 0.6, 8)
    top.position.set(0, 4, 0); scene.add(top)

    // ?? ?¬ì§ ??
    const skin   = new THREE.MeshStandardMaterial({ color: avatarStyle.skin, roughness: 0.7, metalness: 0 })
    const white  = new THREE.MeshStandardMaterial({ color: 0xf5f2ef, roughness: 0.2 })
    const iris   = new THREE.MeshStandardMaterial({ color: 0x3b2a18, roughness: 0.15 })
    const pupil  = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.05 })
    const lip    = new THREE.MeshStandardMaterial({ color: 0xc06858, roughness: 0.55 })
    const hair   = new THREE.MeshStandardMaterial({ color: avatarStyle.hair, roughness: 0.85 })
    const shirt  = new THREE.MeshStandardMaterial({ color: avatarStyle.shirt, roughness: 0.8 })
    const collar = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 })

    const group = new THREE.Group()
    groupRef.current = group
    group.position.y = 0.14
    scene.add(group)

    // ?? ë¨¸ë¦¬ ??
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), skin)
    head.scale.set(1, 1.18, 0.92); head.castShadow = true
    group.add(head)

    // ?? ??(ë¦½ì±?¬ì©) ??
    const jaw = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 48, 24, 0, Math.PI*2, Math.PI*0.52, Math.PI*0.48),
      skin
    )
    jaw.position.y = -0.2; jaw.castShadow = true
    jawRef.current = jaw; group.add(jaw)

    // ?? ê· ??
    const makeEar = (x: number) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), skin)
      e.scale.set(0.45, 0.75, 0.35); e.position.set(x, 0.04, 0)
      return e
    }
    group.add(makeEar(-0.51)); group.add(makeEar(0.51))

    // ?? ë¨¸ë¦¬ì¹´ë½ (?¤í??¼ì ?°ë¼ ê¸¸ì´/? ë¬´ ë³ê²? ??
    if (avatarStyle.hairStyle !== 'bald') {
      const topH = avatarStyle.hairStyle === 'short' ? 0.46 : 0.55
      const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 32, 0, Math.PI*2, 0, Math.PI*topH), hair)
      hairTop.position.y = 0.06; hairTop.scale.set(1.03, 1.22, 0.98); group.add(hairTop)

      if (avatarStyle.hairStyle === 'long') {
        // ?ë¨¸ë¦?(ê¸?ë¨¸ë¦¬ë§?
        const hairSideL = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), hair)
        hairSideL.scale.set(0.6, 1.2, 0.5); hairSideL.position.set(-0.44, -0.1, -0.05); group.add(hairSideL)
        const hairSideR = hairSideL.clone(); hairSideR.position.x = 0.44; group.add(hairSideR)
      }
    }

    // ?? ???¨ì ??
    const makeEye = (xOff: number) => {
      const g = new THREE.Group()
      g.position.set(xOff, 0.1, 0.39)

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), white)
      g.add(eyeball)
      // ?ì±Â·?ê³µÂ·?ì´?¼ì´???ë©´ ?í? êµ¬ì²´ ?ë©´(z=0.09)ë³´ë¤ ?´ì§ ?ì ?¬ì¼
      // êµ¬ì²´ ë³¼ë¡ë¶ê° ?í ê°?´ë°ë¥??«ê³  ?ì¤?????¼ë£©?????ê¸´??
      const irisM  = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), iris)
      irisM.position.z = 0.091; g.add(irisM)
      const pupilM = new THREE.Mesh(new THREE.CircleGeometry(0.025, 32), pupil)
      pupilM.position.z = 0.0915; g.add(pupilM)
      const hiMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 })
      const hi     = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), hiMat)
      hi.position.set(0.016, 0.016, 0.092); g.add(hi)
      return g
    }
    const eyeL = makeEye(-0.175); const eyeR = makeEye(0.175)
    eyeGpLRef.current = eyeL; eyeGpRRef.current = eyeR
    group.add(eyeL); group.add(eyeR)

    // ?? ?êº¼? ??
    const makeLid = (xOff: number) => {
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.096, 32, 16, 0, Math.PI*2, 0, Math.PI*0.52),
        new THREE.MeshStandardMaterial({ color: 0xe8a878, roughness: 0.85 })
      )
      lid.position.set(xOff, 0.1, 0.39)
      lid.rotation.x = Math.PI; lid.scale.y = 0.08
      lid.visible = false   // ê¹ë¹¡?ì? ?ì ?¤ì¿¼?ë¡ ì²ë¦¬ ??ì¤ì¬?ì ë¶???ë²ê·¸ ?êº¼?? ?¨ê?
      return lid
    }
    lidLRef.current = makeLid(-0.175); lidRRef.current = makeLid(0.175)
    group.add(lidLRef.current!); group.add(lidRRef.current!)

    // ?? ?ì¹ ??
    const makeBrow = (xOff: number) => {
      const geo = new THREE.CapsuleGeometry(0.005, 0.12, 4, 8)
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 }))
      m.position.set(xOff, 0.24, 0.41)
      m.rotation.z = xOff > 0 ? 0.12 : -0.12
      return m
    }
    const browL = makeBrow(-0.17); browLRef.current = browL; group.add(browL)
    const browR = makeBrow(0.17);  browRRef.current = browR; group.add(browR)

    // ?? ì½???
    const noseGroup = new THREE.Group()
    noseGroup.position.set(0, 0.02, 0.46)
    const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.1, 4, 16), skin)
    noseBridge.rotation.x = Math.PI/2; noseBridge.position.y = 0.04
    noseGroup.add(noseBridge)
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), skin)
    noseTip.position.y = -0.01; noseGroup.add(noseTip)
    group.add(noseGroup)

    // ?? ??(????+ ???ë«?ì ) ??
    // ???? ?ì´ ë²ì´ì¡ì ??ë³´ì´???´ë???ìª½ (?ì¼ë©?ë²ì´ì§??ì¼ë¡?ë°°ê²½??ë¹ì³ ë§ì²??ë³´ì)
    const mouthInner = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.95 })
    )
    mouthInner.position.set(0, -0.21, 0.42)
    mouthInner.scale.set(1, 0.55, 0.35)
    group.add(mouthInner)

    // upper lip and lower lip
    const makeLip = (y: number, len: number, r: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), lip)
      m.rotation.z = Math.PI / 2
      m.position.set(0, y, 0.45)
      group.add(m)
      return m
    }
    const lipUp = makeLip(-0.19, 0.13, 0.02);  lipUpRef.current = lipUp
    const lipDn = makeLip(-0.23, 0.12, 0.022); lipDnRef.current = lipDn
    // ?? ?ê²½ (?¤í??¼ì ?°ë¼ ì¶ê?) ??
    if (avatarStyle.glasses) {
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 })
      const lensMat  = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.1, transparent: true, opacity: 0.25 })
      const makeGlassEye = (xOff: number) => {
        const g = new THREE.Group(); g.position.set(xOff, 0.1, 0.52)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 32), frameMat)
        g.add(ring)
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 32), lensMat)
        lens.position.z = 0.005; g.add(lens)
        return g
      }
      group.add(makeGlassEye(-0.175)); group.add(makeGlassEye(0.175))
      const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.13, 4, 8), frameMat)
      bridge.rotation.z = Math.PI/2; bridge.position.set(0, 0.1, 0.525); group.add(bridge)
    }

    // ?? ëª???
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.38, 32), skin)
    neck.position.y = -0.72; group.add(neck)

    // ?? ?ì (?ì¥) ??
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 8, 16), shirt)
    body.position.y = -1.3; group.add(body)
    // ì¹¼ë¼
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.04), collar)
    collarL.position.set(-0.07, -0.82, 0.35); collarL.rotation.z = 0.3; group.add(collarL)
    const collarR = collarL.clone(); collarR.position.x = 0.07; collarR.rotation.z = -0.3; group.add(collarR)

    // ?? ?´ë¦??(?ë©´) ??
    const badgeGeo = new THREE.PlaneGeometry(0.28, 0.1)
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    const badge = new THREE.Mesh(badgeGeo, badgeMat)
    badge.position.set(0.18, -1.05, 0.42); group.add(badge)

    // ?? ë°ë¥ ??
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI/2; floor.position.y = -2.0; floor.receiveShadow = true
    scene.add(floor)

    // ?? ë°°ê²½ ë¹??í ê¸ë¡ì° ??
    const glowGeo = new THREE.CircleGeometry(1.2, 64)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x2233aa, transparent: true, opacity: 0.12 })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.position.set(0, 0, -1.5); scene.add(glow)

    // ?? ? ëë©ì´????
    let blinkNext = 3 + Math.random() * 3
    let blinking  = false
    let blinkT    = 0

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const t = clockRef.current.getElapsedTime()

      // ?ì´???¸í¡ (ë¯¸ì¸ ?í)
      group.position.y = 0.14 + Math.sin(t * 0.6) * 0.012

      // ?¹ìº  ?¼êµ´ ì¶ì  ì¤ì´ë©??¬ì©???ì (ë¸ë ?ì°?´í)???°ë¼ê°????? ?ë°?ê° ?µë?(TTS) ì¤ì¼ ?ë
      // ?¤ë??ê¸°ë° ë¦½ì±?¬ê? ??ëª¨ì??ë§¡ëë¡??¼êµ´ ì¶ì ? ? ì ?ë³´?ë¤ (?ì´ ì¶©ë?ë©´ ?ì´ ?´ì?´ì§)
      const face = !analyserRef.current ? faceBlendRef.current : null
      const pose = !analyserRef.current ? headPoseRef.current : null
      const fb = (name: string) => face?.[name] ?? 0

      // Head pose is coming from the mirrored camera preview; flip left-right and roll to match it.
      if (pose) {
        group.rotation.y += (-pose.yaw   * 0.8 - group.rotation.y) * 0.25
        group.rotation.x += (-pose.pitch * 0.8 - group.rotation.x) * 0.25
        group.rotation.z += (-pose.roll  * 0.6 - group.rotation.z) * 0.25
      } else {
        group.rotation.y = Math.sin(t * 0.25) * 0.05
        group.rotation.x = Math.sin(t * 0.18) * 0.015
        group.rotation.z += (0 - group.rotation.z) * 0.1
      }

      // ?ì? ?ë©´(ì¹´ë©?? ê³ ì  ??lookAt???°ë©´ ?¼ë° Object3D ?¹ì±??+Zê° ?ê¹?ë°ë?ë¡??¥í´
      // ?ì´ ???¤ë¡ ?ìê°ë©??¬íÂ·?¬ë²?ì²??ë³´ì??? ë¨¸ë¦¬ ?ì (group)???°ë¼ ?ì°?¤ë½ê²??ì§ì.

      if (face) {
        // MediaPipe ë¸ë ?ì°?´í???«í ?????ì?ë 0???ë???¡ì(0.05~0.15)???¼ê³ ,
        // ìµë?ë¡?ë²ë ¤??1.0ê¹ì? ????ê°ë¯ë¡????°ëì¡?lo ?´í??0)?¼ë¡ ?¡ì???ë¥´ê³?        // ê²ì¸?¼ë¡ ?¤ì¬??ë²ìë¥?0~1 ??¤ì?¼ë¡ ?ê·?í??
        const norm = (v: number, lo: number, gain: number) => Math.min(1, Math.max(0, v - lo) * gain)

        // ??ê¹ë¹¡????ì¢ì°ë¥??ê·  ???ì?? ?ì ê·¸ë£¹???¸ë¡ë¡?ì°ê·¸?¬ë¨???¤ì¿¼?? ê°ì.
        // scale.y=1 ???í, ~0.1 ê°ì? ?í. ì¤ì¬ ê¸°ì??´ë¼ ???ì¹ê° ???´ê¸??
        const blink = norm((fb('eyeBlinkLeft') + fb('eyeBlinkRight')) / 2, 0.15, 2.2)
        const eyeSq = 1 - blink * 0.9
        if (eyeGpLRef.current) eyeGpLRef.current.scale.y += (eyeSq - eyeGpLRef.current.scale.y) * 0.5
        if (eyeGpRRef.current) eyeGpRRef.current.scale.y += (eyeSq - eyeGpRRef.current.scale.y) * 0.5

        // ????jawOpen???ê·????TTS ë¦½ì±?¬ì? ?ì¼??ë§¤í?¼ë¡ ?±Â·ì? ì ë²ë¦¼
        const open = norm(fb('jawOpen'), 0.10, 2.5) * 0.14
        if (jawRef.current) {
          jawRef.current.position.y += (-0.2 - open - jawRef.current.position.y) * 0.4
          jawRef.current.rotation.x += (-open * 1.2 - jawRef.current.rotation.x) * 0.4
        }
        if (lipUpRef.current) lipUpRef.current.position.y += (-0.19 - open * 0.35 - lipUpRef.current.position.y) * 0.4
        if (lipDnRef.current) {
          lipDnRef.current.position.y += (-0.23 - open * 0.85 - lipDnRef.current.position.y) * 0.4
          lipDnRef.current.scale.set(1, 1, 1)
        }

        // ?ì¹? ì¶ì  ??ê·¸ë?ë¡??ë ?ì???ì¹ë¡?ë³µê? (ì¢ì° ë¹ë?ì¹?ë§¤í???´ì??ë³´ì¬ ?ê±°)
        if (browLRef.current) browLRef.current.position.y += (0.24 - browLRef.current.position.y) * 0.15
        if (browRRef.current) browRRef.current.position.y += (0.24 - browRRef.current.position.y) * 0.15
      } else {
        // ?? ?¹ìº  ë¯¸ì¬??????ê¸°ì¡´ ?ë ë¸ë§??+ TTS ?¤ë??ê¸°ë° ë¦½ì±????
        blinkNext -= 0.016
        if (!blinking && blinkNext <= 0) { blinking = true; blinkT = 0; blinkNext = 3 + Math.random() * 4 }
        if (blinking) {
          blinkT += 0.06
          const s = blinkT < Math.PI ? Math.sin(blinkT) : 0   // 0????
          const sc = 1 - s * 0.9                               // 1(????.1(ê°ì)??
          if (eyeGpLRef.current) eyeGpLRef.current.scale.y = sc
          if (eyeGpRRef.current) eyeGpRRef.current.scale.y = sc
          if (blinkT >= Math.PI) {
            blinking = false
            if (eyeGpLRef.current) eyeGpLRef.current.scale.y = 1
            if (eyeGpRRef.current) eyeGpRRef.current.scale.y = 1
          }
        }

        if (analyserRef.current && jawRef.current) {
          const buf = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(buf)
          const avg = buf.slice(0, 8).reduce((a, b) => a + b, 0) / 8
          // ì¡°ì©??êµ¬ê°(?¸ì´ì¦?ë°ë¥)? ?ì ?¤ë¬¼ê³? ë§í  ?ë§ ?´ì§ ë²ì´ì§ê²????? ?ë° ?´íë¡?ì¶ì
          const open = Math.max(0, avg / 255 - 0.18) * 0.08
          jawRef.current.position.y += (-0.2 - open - jawRef.current.position.y) * 0.35
          jawRef.current.rotation.x = -open * 1.2

          // lips move a little more while speaking
          // lips move a little more while speaking
          if (lipUpRef.current) lipUpRef.current.position.y += (-0.19 - open * 0.35 - lipUpRef.current.position.y) * 0.4
          if (lipDnRef.current) {
            lipDnRef.current.position.y += (-0.23 - open * 0.85 - lipDnRef.current.position.y) * 0.4
            lipDnRef.current.scale.set(1, 1, 1)
          }
          if (groupRef.current) {
            groupRef.current.rotation.x += Math.sin(t * 5) * open * 0.5
          }
          const browLift = Math.sin(t * 3.3) * open * 0.4
          if (browLRef.current) browLRef.current.position.y += (0.24 + browLift - browLRef.current.position.y) * 0.3
        } else {
          if (jawRef.current) {
            jawRef.current.position.y += (-0.2 - jawRef.current.position.y) * 0.12
            jawRef.current.rotation.x += (0 - jawRef.current.rotation.x) * 0.12
          }
          if (lipUpRef.current) lipUpRef.current.position.y += (-0.19 - lipUpRef.current.position.y) * 0.2
          if (lipDnRef.current) {
            lipDnRef.current.position.y += (-0.23 - lipDnRef.current.position.y) * 0.2
            lipDnRef.current.scale.set(1, 1, 1)
          }
          if (browLRef.current) browLRef.current.position.y += (0.24 - browLRef.current.position.y) * 0.15
          if (browRRef.current) browRRef.current.position.y += (0.24 - browRRef.current.position.y) * 0.15
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w2 = canvas.clientWidth, h2 = canvas.clientHeight
      camera.aspect = w2/h2; camera.updateProjectionMatrix()
      renderer.setSize(w2, h2, false)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [avatarStyleId])

  // ?? ?ë ?¸ì¬ (?ì´ì§ ë¡ë ?? ??
  useEffect(() => {
    if (messages.length > 0) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/conversation/history?view=avatar3d&limit=50`)
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages(data.messages)
          return
        }
      } catch { /* ì²ë¦¬ ?¤í¨ ??ì¸?¬ë¡ ?´ë°± */ }
      if (cancelled) return
      setMessages([{ role: 'assistant', content: GREETING }])
      respond(GREETING)
    }, 1200)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ?ë°? ?ì¤???ë¡¬?í¸: ë°±ì??/avatar/contextê° ?ë¡?ì¼+ê´?¬ì¬+RAGë¥??µí© ?ì±
  const buildSystemPrompt = useCallback(async (userText: string): Promise<string> => {
    try {
      const res = await fetch(`${API}/avatar/context?q=${encodeURIComponent(userText)}`)
      const data = await res.json()
      if (data?.system) return data.system as string
    } catch { /* ì»¨í?¤í¸ ë¡ë ?¤í¨ ??ê¸°ë³¸ ?ë¡¬?í¸ë¡??´ë°± */ }
    return '?¹ì ? ?¬ì©?ì ?ì????ë°??ë?? 1?¸ì¹­?¼ë¡ ì§§ê³  ?ì°?¤ë½ê²??êµ­?´ë¡ ?µí?¸ì.'
  }, [])

  // ???turn ë¡ê¹ ??ë§í¬/?±ê²© ?ìµ ë£¨í???ì¬ë£?(?¤í¨?´ë ì±í ?ë¦???í¥ ?ì)
  const logTurn = useCallback((role: 'user' | 'assistant', content: string) => {
    if (!content.trim()) return
    fetch(`${API}/conversation/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: 'avatar3d', role, content }),
    }).catch(() => {})
  }, [])

  // ?? AI ?¸ì¶ ??
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || chatLoading) return
    const isSttEcho = !!overrideText && sttEchoRef.current === text
    const userMsg: ChatMsg = { role: 'user', content: text, source: overrideText ? 'stt' : 'typed' }
    if (!isSttEcho) setMessages(prev => [...prev, userMsg])
    setInput(''); setChatLoading(true)
    logTurn('user', text)
    sttEchoRef.current = null

    try {
      if (!hasAiConnection) throw new Error('AIê° ?°ê²°?ì? ?ì?µë?? ë¡ì»¬ Ollamaë¥??¤í?ê±°???¤ì ?ì AI ?ê³µ?ë? ?°ê²°?´ì£¼?¸ì.')

      const history = [...messages, userMsg].slice(-8)
      const system = await buildSystemPrompt(text)
      let reply = ''
      await callAvatarAI(history, system, d => { reply += d })
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (reply) { logTurn('assistant', reply); respond(reply) }
    } catch (e) {
      const errMsg = `?¤ë¥: ${e instanceof Error ? e.message : String(e)}`
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
      respond('ì£ì¡?©ë?? ?¼ì?ì¸ ?¤ë¥ê° ë°ì?ìµ?ë¤.')
    } finally { setChatLoading(false) }
  }, [input, chatLoading, messages, hasAiConnection, callAvatarAI, buildSystemPrompt, logTurn, respond])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSplitPointerDown = useCallback((event: { preventDefault: () => void; clientX: number }) => {
    event.preventDefault()
    const update = (clientX: number) => {
      const bounds = workspaceRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return
      const raw = ((clientX - bounds.left) / bounds.width) * 100
      const next = Math.min(72, Math.max(28, raw))
      setSplitRatio(next)
    }
    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    update(event.clientX)
  }, [])

  return (
    <div ref={workspaceRef} className="flex h-full overflow-hidden bg-gray-950">
      {/* 3D ë·?*/}
      <div
        className="relative min-w-[360px]"
        style={{ flex: `0 0 ${splitRatio}%` }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />

        {/* ?¼êµ´ ?¸ë???¨ë ???¹ìº  + MediaPipe ì¶ì  + 3D ë©ì ?ì¤ì²?ë§¤í + ?¤ê³½???¹í (ì¢ì?? */}
        <FaceTrackingPanel
          className="absolute bottom-4 right-4 z-20 w-[18rem] max-w-[24vw] rounded-xl border border-gray-700 shadow-2xl bg-black overflow-hidden"
          onBlendshapes={handleFaceBlendshapes}
          onHeadPose={handleHeadPose} />

        {/* 3D ?ë°? ?¸í ?¤í???? í (?°ì?? */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5">
          <button
            onClick={() => setSettingsOpen(open => !open)}
            className="flex items-center gap-1.5 bg-black/30 backdrop-blur rounded-lg px-2 py-1.5 text-left border border-gray-700/70 text-gray-100 shadow-md"
          >
            <span className="text-[9px] uppercase tracking-wide text-gray-400">Settings</span>
            <span className="text-[11px] font-medium">{settingsOpen ? 'Open' : 'Closed'}</span>
            <span className="text-[10px] text-gray-400">{settingsOpen ? '▴' : '▾'}</span>
          </button>
          {settingsOpen && (
            <div className="bg-black/30 backdrop-blur rounded-lg p-2 border border-gray-700/70 space-y-2">
              <div>
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="text-[9px] uppercase tracking-wide text-gray-400">Style</span>
                  <span className="text-[11px] font-medium text-gray-100">{avatarStyle.label}</span>
                </div>
                <div className="flex flex-wrap justify-start gap-1 max-w-[12rem]">
                  {AVATAR_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectAvatarStyle(s.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        avatarStyleId === s.id
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-gray-800/70 border-gray-600 text-gray-300 hover:bg-gray-700/70'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="text-[9px] uppercase tracking-wide text-gray-400">Voice</span>
                  <span className="text-[11px] font-medium text-gray-100">{selectedVoice.label}</span>
                </div>
                <div className="flex flex-wrap justify-start gap-1 max-w-[12rem]">
                  {voiceOptions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => selectVoiceOption(v.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        voiceOptionId === v.id
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-gray-800/70 border-gray-600 text-gray-300 hover:bg-gray-700/70'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {speaking && (
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-2 rounded-full">
              <div className="flex gap-1 items-end">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ height: `${8 + Math.sin(i * 1.2) * 7}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <span className="text-xs text-blue-300">Speaking</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Panel resize"
        onPointerDown={handleSplitPointerDown}
        className="w-2 shrink-0 cursor-col-resize border-x border-gray-800 bg-gray-900/80 hover:bg-blue-600/30 transition-colors"
      />

      <div className="flex-1 min-w-0 flex flex-col border-l border-gray-800 bg-gray-900/95">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasAiConnection ? 'bg-green-400' : 'bg-red-400'}`} />
            <h2 className="text-sm font-semibold text-gray-200">아바타 AI</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasAiConnection ? `${providerLabel} 연결됨 · 음성 재생 준비 완료` : 'AI 연결 안 됨'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs mr-2 shrink-0 mt-0.5">?¤</div>
              )}
              <div className={`max-w-[88%] rounded-xl px-3 py-2.5 text-sm leading-relaxed
                ${m.role === 'user'
                  ? 'bg-gray-900 text-white rounded-tr-sm whitespace-pre-wrap'
                  : 'bg-gray-100 border border-gray-700 text-gray-800 rounded-tl-sm'}`}>
                {m.role === 'assistant'
                  ? (m.content
                      ? <ChatMarkdown content={m.content} />
                      : (chatLoading && i === messages.length - 1 ? '??? ?ë¬ê½¦ ä»?..' : ''))
                  : m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs shrink-0">?¤</div>
              <div className="bg-gray-100 border border-gray-700 rounded-xl rounded-tl-sm px-3 py-2 flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-gray-800 space-y-2">
          {!hasAiConnection && (
            <p className="text-xs text-amber-500">
              로컬 Ollama({OLLAMA_ENDPOINT})가 실행 중인지 확인하거나, 설정에서 다른 AI 제공자를 연결해 주세요.
            </p>
          )}
          {/* ?ì± ?¸ì ê²°ê³¼ ?ì ì°?*/}
          {(recording || sttBusy || sttResult || sttError) && (
            <div className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-xs space-y-1">
              {recording && !sttBusy && (
                <div className="space-y-1">
                  <p className={vadActive ? 'text-green-400' : 'text-gray-400'}>
                    {vadActive ? '듣는 중 · 말하면 자동으로 인식합니다' : '대기 중 · 말하면 인식합니다'}
                  </p>
                  {/* Mic level indicator. Starts listening when the threshold is crossed. */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0">마이크</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${micLevel > THRESHOLD ? 'bg-green-400' : 'bg-gray-500'}`}
                        style={{ width: `${Math.min(100, micLevel * 2)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-6 text-right">{micLevel}</span>
                  </div>
                </div>
              )}
              {sttBusy && <p className="text-gray-400">음성 처리 중...</p>}
              {sttResult && !sttBusy && (
                <p className="text-gray-300">
                  <span className="text-gray-500">음성 인식 완료{sttResult.language ? ` (${sttResult.language})` : ''}</span>
                </p>
              )}
              {sttError && <p className="text-red-400">{sttError}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={startStt}
              title={recording ? '음성 모드 끄기' : '음성 모드 켜기'}
              className={`px-3 py-2 text-sm rounded-xl transition disabled:opacity-40 ${
                recording
                  ? (vadActive ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse' : 'bg-red-600 hover:bg-red-500 text-white')
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}>
              {recording ? (vadActive ? '켜짐' : '대기') : '마이크'}
            </button>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="질문을 입력하거나 마이크를 눌러 말하세요"
              disabled={!hasAiConnection}
              className="flex-1 bg-gray-800 text-sm text-gray-200 rounded-xl px-3 py-2 outline-none border border-gray-700 focus:border-blue-600 placeholder-gray-600 disabled:opacity-40" />
            <button onClick={() => sendMessage()}
              disabled={!input.trim() || chatLoading || !hasAiConnection}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-sm rounded-xl transition">
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

