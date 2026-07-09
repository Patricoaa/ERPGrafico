export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max'
export type AggregateFormat = 'money' | 'number' | 'integer'

export interface AggregatorDef {
  key: string
  label: string
  field?: string
  fn: AggregateFn
  format?: AggregateFormat
}

export interface TextFieldDef {
  key: string
  label: string
  serverParam: string
  suggestionsUrl?: string
}

export interface ToggleFilterDef {
  type: 'toggle'
  key: string
  label: string
  serverParam: string
  activeValue?: string
  inactiveValue?: string
}

export interface DateFilterOption {
  label: string
  serverParamFrom?: string
  serverParamTo?: string
  getValue?: () => { from: string; to: string }
}

export interface DateFilterDef {
  type: 'date'
  key: string
  label: string
  options: DateFilterOption[]
}

export interface RangeFilterDef {
  type: 'range'
  key: string
  label: string
  serverParamFrom: string
  serverParamTo: string
  placeholderFrom?: string
  placeholderTo?: string
}

export interface MultiSelectOption {
  label: string
  value: string
}

export interface MultiSelectFilterDef {
  type: 'multi'
  key: string
  label: string
  serverParam: string
  options: MultiSelectOption[]
}

export interface CustomFilterDef {
  type: 'custom'
  key: string
  label: string
  serverParam?: string
  render: (helpers: {
    apply: (param: string, value: string) => Promise<void>
    remove: (param: string) => Promise<void>
    isActive: boolean
  }) => React.ReactNode
}

export type DropdownFilterDef = ToggleFilterDef | RangeFilterDef | MultiSelectFilterDef | CustomFilterDef

export interface GroupByOptionDef {
  key: string
  label: string
  field: string
  aggregators?: AggregatorDef[]
  default?: boolean
}

export interface UnifiedSearchConfig {
  searchFields: TextFieldDef[]
  filters?: DropdownFilterDef[]
  dateFilters?: DateFilterDef[]
  groupBy?: GroupByOptionDef[]
  basePeriod?: {
    serverParamFrom: string
    serverParamTo: string
  }
}

export interface UnifiedChip {
  id: string
  label: string
  valueLabel: string
  variant: 'search' | 'filter' | 'date' | 'range' | 'group'
  onRemove: () => void
}

export interface UseUnifiedSearchReturn {
  filters: Record<string, string>
  paramValues: Record<string, string | null>
  chips: UnifiedChip[]
  isFiltered: boolean
  groupBy: string | null
  setGroupBy: (key: string | null) => Promise<void>
  applyFilter: (param: string, value: string) => Promise<void>
  removeFilter: (param: string) => Promise<void>
  clearAll: () => Promise<void>
  inputValue: string
  setInputValue: (val: string) => void
}
