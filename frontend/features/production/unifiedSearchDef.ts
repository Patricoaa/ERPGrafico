import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const bomUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Producto / Nombre', serverParam: 'search' },
  ],
  filters: [
    {
      type: 'single',
      key: 'active',
      label: 'Estado',
      serverParam: 'active',
      options: [
        { label: 'Activa', value: 'true' },
        { label: 'Inactiva', value: 'false' },
      ],
    },
  ],
  groupBy: [
    { key: 'active', label: 'Estado', field: 'active' },
  ],
}

export const workOrderUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Descripción / Folio', serverParam: 'search' },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'En Proceso', value: 'IN_PROGRESS' },
        { label: 'Terminada', value: 'FINISHED' },
        { label: 'Anulada', value: 'CANCELLED' },
      ],
    },
    {
      type: 'toggle',
      key: 'my_tasks',
      label: 'Mis OTs',
      serverParam: 'my_tasks',
      activeValue: 'true',
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'due_date',
    label: 'Fecha Entrega',
    options: [
      { label: 'Hoy', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before', getValue: thisYear },
    ],
  }],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'current_stage', label: 'Etapa', field: 'current_stage' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
