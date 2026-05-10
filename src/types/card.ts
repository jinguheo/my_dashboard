import { Layout } from 'react-grid-layout'
import React from 'react'

export interface CardMeta {
  id: string
  name: string
  icon: string
  defaultSize: { w: number; h: number }
  component: React.FC
}

export interface CardInstance {
  id: string
  cardId: string
  layout: Layout
}
