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
    {
      key: 'type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'type',
      options: [
        { label: 'Cliente', value: 'CUSTOMER' },
        { label: 'Proveedor', value: 'SUPPLIER' },
        { label: 'Ambos', value: 'BOTH' },
        { label: 'Ninguno', value: 'NONE' },
      ],
    },
  ],
}
