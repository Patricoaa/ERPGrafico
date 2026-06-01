import type { SearchDefinition } from '@/types/search'

export const groupSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
  ],
}
