import { useEffect, useRef } from 'react'
import registry from '@/cards/registry'
import { CardMeta } from '@/types/card'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (meta: CardMeta) => void
}

export default function AddCardMenu({ open, onClose, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div ref={ref} className="bg-surface-card border border-surface-border rounded-xl p-4 w-72 shadow-2xl">
        <h3 className="text-gray-200 font-semibold mb-3">카드 추가</h3>
        <div className="grid grid-cols-2 gap-2">
          {registry.map(meta => (
            <button
              key={meta.id}
              onClick={() => { onSelect(meta); onClose() }}
              className="flex items-center gap-2 p-3 rounded-lg bg-surface-hover hover:bg-surface-border text-left transition-colors"
            >
              <span className="text-xl">{meta.icon}</span>
              <span className="text-sm text-gray-300">{meta.name}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full text-sm text-gray-500 hover:text-gray-300 transition-colors">
          닫기
        </button>
      </div>
    </div>
  )
}
