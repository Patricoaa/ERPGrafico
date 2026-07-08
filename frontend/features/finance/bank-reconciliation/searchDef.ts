import type { SearchDefinition } from '@/types/search'

export const reconciliationSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Buscar',
      type: 'text',
      serverParam: 'search',
    },
  ],
}
