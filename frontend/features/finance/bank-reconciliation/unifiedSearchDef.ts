import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const reconciliationUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Buscar',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'type',
      label: 'Tipo',
      serverParam: 'type',
      options: [
        { label: 'Abonos / Ingresos', value: 'IN' },
        { label: 'Cargos / Egresos', value: 'OUT' },
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
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'type', label: 'Tipo', field: 'type' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
