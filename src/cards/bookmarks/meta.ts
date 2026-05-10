import { CardMeta } from '@/types/card'
import BookmarksCard from './index'

const meta: CardMeta = {
  id: 'bookmarks',
  name: '웹 북마크',
  icon: '🌐',
  defaultSize: { w: 6, h: 4 },
  component: BookmarksCard,
}

export default meta
