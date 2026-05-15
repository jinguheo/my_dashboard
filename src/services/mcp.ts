import type { ConnectionAuth } from '@/types'

function authHeaders(auth?: ConnectionAuth): Record<string, string> {
  if (!auth || auth.mode === 'none') return {}
  if (auth.mode === 'api-key' && auth.apiKey) {
    return { Authorization: `Bearer ${auth.apiKey}` }
  }
  if (auth.mode === 'account-password' && auth.username && auth.password) {
    return { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` }
  }
  if (auth.mode === 'username-api-key' && auth.username && auth.apiKey) {
    return {
      Authorization: `Basic ${btoa(`${auth.username}:${auth.apiKey}`)}`,
      'X-API-Key': auth.apiKey,
      'X-Username': auth.username,
    }
  }
  return {}
}

function authArguments(auth?: ConnectionAuth): Record<string, unknown> {
  if (!auth || auth.mode === 'none') return {}
  if (auth.mode === 'api-key' && auth.apiKey) {
    return { auth: { mode: 'api-key', apiKey: auth.apiKey } }
  }
  if (auth.mode === 'account-password' && auth.username && auth.password) {
    return { auth: { mode: 'account-password', username: auth.username, password: auth.password } }
  }
  if (auth.mode === 'username-api-key' && auth.username && auth.apiKey) {
    return { auth: { mode: 'username-api-key', username: auth.username, apiKey: auth.apiKey } }
  }
  return {}
}

export async function callMcpTool<T = unknown>(
  endpoint: string,
  name: string,
  args: Record<string, unknown> = {},
  auth?: ConnectionAuth,
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(auth) },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: { ...args, ...authArguments(auth) } },
    }),
  })

  if (!res.ok) throw new Error(`MCP request failed: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'MCP tool error')

  const content = data?.result?.content
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0]
    if (first.json !== undefined) return first.json as T
    if (first.text !== undefined) {
      try { return JSON.parse(first.text) as T } catch { return first.text as T }
    }
  }

  return (data?.result?.json ?? data?.result?.data ?? data?.result) as T
}

export async function listMcpTools(
  endpoint: string,
  auth?: ConnectionAuth,
): Promise<Array<{ name: string; description?: string }>> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(auth) },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {},
    }),
  })
  if (!res.ok) throw new Error(`MCP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'MCP error')
  return data?.result?.tools ?? []
}
