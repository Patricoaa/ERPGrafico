import type { SearchDefinition } from '@/types/search'

export const taxPeriodSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'month_display',
      label: 'Período',
      type: 'text',
      serverParam: 'month_display',
      clientKey: ['month_display', 'year'],
    },
  ],
}
