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

export interface Settings {
  anthropicApiKey: string
  weatherApiKey: string
  city: string
  userName: string
  // Email
  gmailClientId: string
  // Chat
  slackToken: string
  slackChannelId: string
  telegramToken: string
}
