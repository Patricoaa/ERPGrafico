import type { SearchDefinition } from '@/types/search'

export const fiscalYearSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'year',
      label: 'Ejercicio',
      type: 'text',
      serverParam: 'year',
      clientKey: 'year',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'En Cierre', value: 'CLOSING' },
        { label: 'Cerrado', value: 'CLOSED' },
      ],
    },
  ],
}

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

export const accountSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cuenta / Código',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const journalEntrySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Descripción',
      type: 'text',
      serverParam: 'search',
    },
  ],
}
