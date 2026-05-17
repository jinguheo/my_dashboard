// 계정+비밀번호로 로그인해서 API 토큰/키를 자동 취득
// Open WebUI, AnythingLLM, LM Studio, 기타 자체 호스팅 서비스 지원

const CANDIDATE_PATHS = [
  { path: '/api/auth/signin',         body: (u: string, p: string) => ({ email: u, password: p }) },
  { path: '/api/v1/auths/signin',     body: (u: string, p: string) => ({ email: u, password: p }) },
  { path: '/api/auth/login',          body: (u: string, p: string) => ({ username: u, password: p }) },
  { path: '/api/v1/auth/login',       body: (u: string, p: string) => ({ username: u, password: p }) },
  { path: '/v1/auth/token',           body: (u: string, p: string) => ({ username: u, password: p }) },
  { path: '/auth/login',              body: (u: string, p: string) => ({ email: u, password: p }) },
  { path: '/api/token',               body: (u: string, p: string) => ({ username: u, password: p }) },
]

function extractKey(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  // 흔한 응답 필드명 순서대로 시도
  for (const field of ['token', 'api_key', 'apiKey', 'access_token', 'accessToken', 'key', 'bearer']) {
    if (typeof d[field] === 'string' && d[field]) return d[field] as string
  }
  // 중첩 구조 (data.user.token 등)
  for (const nested of ['data', 'user', 'result']) {
    if (d[nested] && typeof d[nested] === 'object') {
      const inner = extractKey(d[nested])
      if (inner) return inner
    }
  }
  return null
}

export async function fetchApiKeyViaLogin(
  baseUrl: string,
  username: string,
  password: string,
  customPath?: string,
): Promise<string> {
  const base = baseUrl.replace(/\/$/, '')
  const paths = customPath
    ? [{ path: customPath, body: (u: string, p: string) => ({ username: u, email: u, password: p }) }]
    : CANDIDATE_PATHS

  for (const { path, body } of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body(username, password)),
      })
      if (!res.ok) continue
      const data = await res.json()
      const key = extractKey(data)
      if (key) return key
    } catch {}
  }

  throw new Error('로그인에 실패했습니다. 엔드포인트 주소와 계정 정보를 확인하세요.')
}
