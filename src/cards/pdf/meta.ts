import { CardMeta } from '@/types/card'
import PdfCard from './index'

const meta: CardMeta = {
  id: 'pdf',
  name: 'PDF',
  icon: '📄',
  defaultSize: { w: 6, h: 4 },
  component: PdfCard,
}

export default meta
