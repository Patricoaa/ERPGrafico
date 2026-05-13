import type { SearchDefinition } from '@/types/search'

export const posSessionSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Abierta', value: 'OPEN' },
        { label: 'En cierre', value: 'CLOSING' },
        { label: 'Cerrada', value: 'CLOSED' },
      ],
    },
  ],
}
