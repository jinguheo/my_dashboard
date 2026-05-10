import { CardMeta } from '@/types/card'
import EmailCard from './index'

const meta: CardMeta = {
  id: 'email',
  name: '이메일',
  icon: '📧',
  defaultSize: { w: 3, h: 4 },
  component: EmailCard,
}

export default meta
