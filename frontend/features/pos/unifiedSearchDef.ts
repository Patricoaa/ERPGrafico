import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const posSessionUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Abierta', value: 'OPEN' },
        { label: 'En cierre', value: 'CLOSING' },
        { label: 'Cerrada', value: 'CLOSED' },
      ],
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const terminalPosUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activas', value: 'ACTIVE' },
        { label: 'Inactivas', value: 'INACTIVE' },
      ],
    },
  ],
}
