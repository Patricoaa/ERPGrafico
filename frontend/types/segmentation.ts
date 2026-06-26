import type { ComponentType } from 'react'

export type TabSegmentDef = {
  key: string
  label: string
  type: 'tabs'
  serverParam: string
  options: { label: string; value: string; icon?: ComponentType<{ className?: string }> }[]
  defaultValue?: string
  variant?: 'tabs' | 'dropdown'
}

export type DateSegmentDef = {
  key: string
  label: string
  type: 'date'
  serverParamDate?: string
  serverParamFrom?: string
  serverParamTo?: string
}

export type PeriodSegmentDef = {
  key: string
  label: string
  type: 'period'
  serverParamFrom: string
  serverParamTo: string
}

export type RangeSegmentDef = {
  key: string
  label: string
  type: 'range'
  serverParamFrom: string
  serverParamTo: string
  placeholderFrom?: string
  placeholderTo?: string
}

export type MultiSelectSegmentDef = {
  key: string
  label: string
  type: 'multiselect'
  serverParam: string
  options: { label: string; value: string; icon?: ComponentType<{ className?: string }> }[]
  dynamic?: boolean
  columnId?: string
}

export type CustomSegmentDef = {
  key: string
  label: string
  type: 'custom'
  serverParam?: string
  render: (helpers: {
    apply: (value: string) => Promise<void>
    remove: () => Promise<void>
    isActive: boolean
  }) => React.ReactNode
}

export type SegmentDef = TabSegmentDef | DateSegmentDef | PeriodSegmentDef | RangeSegmentDef | MultiSelectSegmentDef | CustomSegmentDef

export type SegmentationDefinition = {
  segments: SegmentDef[]
}

export type SegmentationFilterState = Record<string, string>
