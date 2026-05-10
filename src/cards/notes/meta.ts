import { CardMeta } from '@/types/card'
import NotesCard from './index'

const meta: CardMeta = {
  id: 'notes',
  name: '노트',
  icon: '📝',
  defaultSize: { w: 3, h: 4 },
  component: NotesCard,
}

export default meta
