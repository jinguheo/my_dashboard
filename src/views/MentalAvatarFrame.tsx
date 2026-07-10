import { useEffect, useState } from 'react'

const MENTAL_AVATAR_URL = 'http://localhost:5174/'
const MENTAL_AVATAR_API = 'http://127.0.0.1:8766'

type Status = 'checking' | 'ready' | 'frontend-missing' | 'api-missing'

async function isReachable(url: string) {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 1500)
    await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal })
    window.clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

export default function MentalAvatarFrame() {
  const [status, setStatus] = useState<Status>('ready')

  async function checkStatus(showChecking = true) {
    if (showChecking) setStatus('checking')
    const [frontendOk, apiOk] = await Promise.all([
      isReachable(MENTAL_AVATAR_URL),
      isReachable(`${MENTAL_AVATAR_API}/health`),
    ])
    if (!frontendOk) setStatus('frontend-missing')
    else if (!apiOk) setStatus('api-missing')
    else setStatus('ready')
  }

  useEffect(() => {
    checkStatus(false)
  }, [])

  if (status === 'ready') {
    return (
      <iframe
        src={MENTAL_AVATAR_URL}
        title="Mental Avatar"
        className="h-full w-full border-0"
        allow="microphone; camera; autoplay; clipboard-write"
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-[#f4f6f8] p-6">
      <div className="w-full max-w-xl rounded-lg border border-surface-border bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Mental Avatar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Local services are checked before opening the embedded app.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-sm">
          {status === 'checking' && <p className="text-gray-500">Checking local services...</p>}
          {status === 'frontend-missing' && (
            <p className="text-red-600">Frontend server is not running on port 5174.</p>
          )}
          {status === 'api-missing' && (
            <p className="text-amber-700">Frontend is running, but the API on port 8766 is not ready.</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => checkStatus()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Recheck
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-gray-400">
          Mental Avatar runs at http://localhost:5174/. Optional heavy extras use `set START_AVATAR_EXTRAS=1`.
        </p>
      </div>
    </div>
  )
}
