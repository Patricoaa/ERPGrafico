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
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'Cerrado', value: 'CLOSED' },
        { label: 'En Revisión', value: 'UNDER_REVIEW' },
      ],
    },
  ],
}
