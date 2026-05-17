import type { SearchDefinition } from '@/types/search'

export const reconciliationSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Buscar',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'type',
      options: [
        { label: 'Abonos / Ingresos', value: 'IN' },
        { label: 'Cargos / Egresos', value: 'OUT' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'daterange',
      serverParamStart: 'date_from',
      serverParamEnd: 'date_to',
    },
  ],
}
