export type Priority = 'high' | 'medium' | 'low'
export type View = 'dashboard' | 'todos' | 'notes' | 'calendar' | 'ai' | 'email' | 'chat' | 'settings' | 'history' | 'knowledge' | 'avatar' | 'avatar3d' | 'journal'

export interface Todo {
  id: string
  text: string
  done: boolean
  priority: Priority
  category: string
  dueDate?: string
  createdAt: string
  completedAt?: string
}

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  color: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export type ConnectionAuthMode = 'none' | 'api-key' | 'account-password' | 'username-api-key'

export interface ConnectionAuth {
  mode: ConnectionAuthMode
  apiKey?: string
  username?: string
  password?: string
}

export interface MailAccount {
  id: string
  name: string
  provider: 'gmail' | 'mcp' | 'naver' | 'imap'
  clientId?: string
  mcpEndpoint?: string
  inboxTool?: string
  auth?: ConnectionAuth
  extraArgs?: Record<string, unknown>
  // IMAP 전용 (naver / imap provider)
  imapHost?: string
  imapPort?: number
  imapSsl?: boolean
}

export interface CalendarAccount {
  id: string
  name: string
  provider: 'google' | 'mcp' | 'caldav' | 'ics'
  clientId?: string
  mcpEndpoint?: string
  eventsTool?: string
  auth?: ConnectionAuth
  extraArgs?: Record<string, unknown>
  // CalDAV 전용
  caldavEmail?: string
  caldavPassword?: string
  // ICS URL 전용
  icsUrl?: string
}

export interface ChatConnection {
  id: string
  name: string
  platform: 'slack' | 'telegram' | 'mcp'
  token?: string
  channelId?: string
  mcpEndpoint?: string
  channelsTool?: string
  messagesTool?: string
  auth?: ConnectionAuth
  extraArgs?: Record<string, unknown>
}

export interface JournalEntry {
  id: string
  content: string
  tags: string[]
  autoTags: string[]
  createdAt: string
}

export interface JournalAnalysis {
  keywords: string[]
  analyzedAt: string
}

export type AiProvider = 'claude' | 'chatgpt' | 'custom' | 'claude-web' | 'ollama'

export interface Settings {
  anthropicApiKey: string
  openaiApiKey: string
  customAiEndpoint: string
  customAiModel: string
  aiProvider: AiProvider
  claudeSessionKey: string
  weatherApiKey: string
  finnhubApiKey: string
  city: string          // 하위 호환용 (단일 도시)
  weatherCities: string // 쉼표 구분 다중 도시
  userName: string
  dailyRoutine: string
  stockSymbols: string
  mcpEndpoint: string
  dataAccessMode: 'api-key' | 'mcp'
  // Email
  gmailClientId: string
  mailAccounts: MailAccount[]
  calendarAccounts: CalendarAccount[]
  // Chat
  slackToken: string
  slackChannelId: string
  telegramToken: string
  chatConnections: ChatConnection[]
  // Search & RSS
  searchEngine: 'google' | 'naver' | 'youtube' | 'github' | 'duckduckgo'
  rssFeeds: string // 줄바꿈 구분 RSS URL 목록
}
