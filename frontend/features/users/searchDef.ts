import type { SearchDefinition } from '@/types/search'

export const userSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / Email / Usuario',
      type: 'text',
      serverParam: 'search',
      clientKey: ['username', 'email', 'first_name', 'last_name'],
    },
  ],
}
