import { CardMeta } from '@/types/card'
import todoMeta from './todo/meta'
import notesMeta from './notes/meta'
import emailMeta from './email/meta'
import chatMeta from './chat/meta'
import pdfMeta from './pdf/meta'
import bookmarksMeta from './bookmarks/meta'

const registry: CardMeta[] = [
  todoMeta,
  notesMeta,
  emailMeta,
  chatMeta,
  pdfMeta,
  bookmarksMeta,
]

export function getCard(id: string): CardMeta | undefined {
  return registry.find(c => c.id === id)
}

export default registry
