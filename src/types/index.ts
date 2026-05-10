export type Priority = 'high' | 'medium' | 'low'
export type View = 'dashboard' | 'todos' | 'notes' | 'calendar' | 'ai' | 'email' | 'chat' | 'settings'

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
  provider: 'gmail' | 'mcp'
  clientId?: string
  mcpEndpoint?: string
  inboxTool?: string
  auth?: ConnectionAuth
  extraArgs?: Record<string, unknown>
}

export interface CalendarAccount {
  id: string
  name: string
  provider: 'google' | 'mcp'
  clientId?: string
  mcpEndpoint?: string
  eventsTool?: string
  auth?: ConnectionAuth
  extraArgs?: Record<string, unknown>
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

export interface Settings {
  anthropicApiKey: string
  weatherApiKey: string
  finnhubApiKey: string
  city: string
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
}
