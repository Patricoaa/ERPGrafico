export interface TextFieldDef {
  key: string
  label: string
  serverParam: string
  suggestionsUrl?: string
  clientKey?: string | string[]
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
  dynamic?: boolean
  columnId?: string
}

export interface SingleSelectFilterDef {
  type: 'single'
  key: string
  label: string
  serverParam: string
  options?: MultiSelectOption[]
  defaultValue?: string
  dynamic?: boolean
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

export type DropdownFilterDef = ToggleFilterDef | RangeFilterDef | MultiSelectFilterDef | SingleSelectFilterDef | CustomFilterDef

export interface GroupByOptionDef {
  key: string
  label: string
  field: string
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

export interface ViewTabsConfig {
  items: {
    value: string
    label: string
    icon?: React.ComponentType<{ className?: string }>
    badge?: string | number
    hasErrors?: boolean
    hidden?: boolean
    disabled?: boolean
  }[]
  value: string
  onValueChange: (value: string) => void
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
  filterFn: <T>(data: T[]) => T[]
  filterOptions: Record<string, MultiSelectOption[]>
}
