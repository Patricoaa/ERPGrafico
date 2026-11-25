import type { UnifiedSearchConfig } from '@/types/unified-search'
import { periodPresets } from '@/lib/date-presets'

// Purchase orders, receipts, returns and fulfillment declare their query in their `*.entity.ts`
// (ADR-0158 wave 3d-1). Subscriptions wait for the client mode of `useCollectionQuery`.

export const subscriptionUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Producto',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Pausado', value: 'PAUSED' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'recurrence_period', label: 'Período', field: 'recurrence_period' },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: periodPresets('date_from', 'date_to'),
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
