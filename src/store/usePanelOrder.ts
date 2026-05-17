import { useState } from 'react'

export const DEFAULT_PANELS = ['weather', 'shortcuts', 'stocks', 'grid'] as const
export type PanelId = typeof DEFAULT_PANELS[number]

export const PANEL_LABELS: Record<PanelId, string> = {
  weather: '날씨',
  shortcuts: '바로가기',
  stocks: '주식',
  grid: '할 일 / 브리핑 / 일정 / 노트',
}

const KEY = 'dash-panel-order'

function loadOrder(): PanelId[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULT_PANELS]
    const parsed = JSON.parse(raw) as PanelId[]
    const valid = parsed.filter((id): id is PanelId => (DEFAULT_PANELS as readonly string[]).includes(id))
    const missing = (DEFAULT_PANELS as readonly PanelId[]).filter(id => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return [...DEFAULT_PANELS]
  }
}

export function usePanelOrder() {
  const [order, setOrder] = useState<PanelId[]>(loadOrder)

  function reorder(newOrder: PanelId[]) {
    setOrder(newOrder)
    localStorage.setItem(KEY, JSON.stringify(newOrder))
  }

  return { order, reorder }
}
