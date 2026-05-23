import Anthropic from '@anthropic-ai/sdk'

let cachedClient: Anthropic | null = null
let cachedApiKey = ''

function getClient(apiKey: string): Anthropic {
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    cachedApiKey = apiKey
  }
  return cachedClient
}

export async function streamChat(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  onDelta: (text: string) => void,
): Promise<string> {
  const client = getClient(apiKey)
  let full = ''

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system,
    messages,
  })

  stream.on('text', (text) => {
    full += text
    onDelta(text)
  })

  await stream.finalMessage()
  return full
}

export function briefingSystem(userName: string): string {
  return `당신은 ${userName}님의 개인 AI 어시스턴트입니다. 매일 아침 실용적이고 따뜻한 브리핑을 제공합니다. 한국어로만 응답하세요. 마크다운 없이 자연스러운 문체로 작성하세요.`
}

export function reviewSystem(userName: string): string {
  return `당신은 ${userName}님의 개인 AI 코치입니다. 하루를 돌아보고 솔직하고 건설적인 피드백을 제공합니다. 한국어로만 응답하세요. 마크다운 없이 자연스러운 문체로 작성하세요.`
}

export function strategicSystem(userName: string): string {
  return `당신은 ${userName}님의 전략적 사고 파트너입니다. 깊은 통찰력과 실행 가능한 조언을 제공합니다. 한국어로 응답하되 필요시 영어 용어를 혼용할 수 있습니다. 마크다운 없이 대화체로 작성하세요.`
}

export function buildBriefingMessage(data: {
  pending: string[]
  highPriority: string[]
  completedToday: string[]
  upcomingEvents: string[]
  recentNotes: string[]
  rssNews?: string[]
  aiNews?: string[]
}): string {
  const date = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })
  const rssSection = data.rssNews && data.rssNews.length > 0
    ? `\n- 오늘 뉴스 (RSS): ${data.rssNews.slice(0, 5).join(' / ')}`
    : ''
  const aiSection = data.aiNews && data.aiNews.length > 0
    ? `\n- AI 기술 동향: ${data.aiNews.slice(0, 5).join(' / ')}`
    : ''
  return `오늘 날짜: ${date}

현재 상황:
- 미완료 할 일 ${data.pending.length}개: ${data.pending.slice(0, 5).join(', ') || '없음'}
- 높은 우선순위: ${data.highPriority.join(', ') || '없음'}
- 오늘 완료: ${data.completedToday.join(', ') || '없음'}
- 다가오는 일정: ${data.upcomingEvents.join(', ') || '없음'}
- 최근 노트: ${data.recentNotes.join(', ') || '없음'}${rssSection}${aiSection}

오늘 아침 브리핑을 해주세요. 할 일·일정 중심으로 핵심 집중 항목 3가지를 먼저 정리하고, 뉴스 중 주목할 내용이 있으면 한 줄 언급하세요. 350자 이내로 작성해주세요.`
}

export function buildReviewMessage(data: {
  completedToday: string[]
  pending: string[]
  recentNotes: string[]
}): string {
  const date = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long'
  })
  return `${date} 하루 마무리 리뷰입니다.

완료한 일 ${data.completedToday.length}개: ${data.completedToday.join(', ') || '없음'}
미완료 ${data.pending.length}개: ${data.pending.slice(0, 5).join(', ') || '없음'}
오늘 노트: ${data.recentNotes.join(', ') || '없음'}

오늘 하루를 평가하고 내일을 위한 구체적인 제안을 350자 이내로 해주세요.`
}
