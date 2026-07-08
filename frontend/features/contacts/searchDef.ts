import type { SearchDefinition } from '@/types/search'

export const contactSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / RUT / Email',
      type: 'text',
      serverParam: 'search',
      suggestionsUrl: '/contacts/filter-suggestions/',
    },
  ],
}
