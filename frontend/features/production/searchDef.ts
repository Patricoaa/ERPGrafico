import type { SearchDefinition } from '@/types/search'

export const workOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Descripción / Folio',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const bomSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Producto / Nombre',
      type: 'text',
      serverParam: 'search',
    },
  ],
}
