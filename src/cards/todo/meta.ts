import { CardMeta } from '@/types/card'
import TodoCard from './index'

const meta: CardMeta = {
  id: 'todo',
  name: '할일',
  icon: '✅',
  defaultSize: { w: 3, h: 4 },
  component: TodoCard,
}

export default meta
