import { CardMeta } from '@/types/card'
import ChatCard from './index'

const meta: CardMeta = {
  id: 'chat',
  name: '채팅',
  icon: '💬',
  defaultSize: { w: 3, h: 4 },
  component: ChatCard,
}

export default meta
