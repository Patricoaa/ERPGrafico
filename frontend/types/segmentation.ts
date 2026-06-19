export type TabSegmentDef = {
  key: string
  label: string
  type: 'tabs'
  serverParam: string
  options: { label: string; value: string }[]
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

export type SegmentDef = TabSegmentDef | DateSegmentDef

export type SegmentationDefinition = {
  segments: SegmentDef[]
}

export type SegmentationFilterState = Record<string, string>
