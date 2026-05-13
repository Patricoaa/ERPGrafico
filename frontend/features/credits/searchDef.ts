import type { SearchDefinition } from '@/types/search'

export const creditContactSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / RUT',
      type: 'text',
      serverParam: 'search',
      clientKey: ['name', 'tax_id'],
    },
    {
      key: 'credit_risk_level',
      label: 'Riesgo',
      type: 'enum',
      serverParam: 'credit_risk_level',
      options: [
        { label: 'Bajo', value: 'LOW' },
        { label: 'Medio', value: 'MEDIUM' },
        { label: 'Alto', value: 'HIGH' },
        { label: 'Crítico', value: 'CRITICAL' },
      ],
    },
  ],
}

export const creditHistorySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / Folio',
      type: 'text',
      serverParam: 'search',
      clientKey: ['customer_name', 'number', 'display_id'],
    },
  ],
}
