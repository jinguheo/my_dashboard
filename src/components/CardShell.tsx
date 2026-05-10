import React from 'react'

interface Props {
  icon: string
  name: string
  instanceId: string
  onRemove: (id: string) => void
  children: React.ReactNode
}

export default function CardShell({ icon, name, instanceId, onRemove, children }: Props) {
  return (
    <div className="flex flex-col h-full bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border flex-shrink-0 drag-handle cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-gray-300">{name}</span>
        </div>
        <button
          onClick={() => onRemove(instanceId)}
          className="text-gray-600 hover:text-red-400 text-xs transition-colors"
          title="카드 제거"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 p-3 overflow-hidden min-h-0">
        {children}
      </div>
    </div>
  )
}
