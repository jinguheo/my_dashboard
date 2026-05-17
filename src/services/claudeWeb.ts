import { callMcpTool } from './mcp'

const MCP = 'http://127.0.0.1:8765/mcp'

export async function claudeWebLogin(email: string, password: string): Promise<string> {
  const result = await callMcpTool<{ sessionKey: string }>(MCP, 'claude.login', { email, password })
  if (!result.sessionKey) throw new Error('세션 키를 가져오지 못했습니다.')
  return result.sessionKey
}

export async function streamClaudeWeb(
  sessionKey: string,
  mcpEndpoint: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  onDelta: (text: string) => void,
): Promise<string> {
  const endpoint = mcpEndpoint || MCP
  const result = await callMcpTool<{ text: string }>(endpoint, 'claude.chat', {
    session_key: sessionKey,
    messages,
    system,
  })
  const text = result.text || ''
  // 전체 텍스트를 한 번에 받으므로 delta로 전달
  if (text) onDelta(text)
  return text
}
