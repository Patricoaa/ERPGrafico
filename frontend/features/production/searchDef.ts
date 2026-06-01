import type { SearchDefinition } from '@/types/search'

export const workOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Descripción / Folio',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'En Proceso', value: 'IN_PROGRESS' },
        { label: 'Terminada', value: 'FINISHED' },
        { label: 'Anulada', value: 'CANCELLED' },
      ],
    },
    {
      key: 'due_date',
      label: 'Fecha Entrega',
      type: 'daterange',
      serverParamStart: 'date_from',
      serverParamEnd: 'date_to',
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
    {
      key: 'active',
      label: 'Estado',
      type: 'enum',
      serverParam: 'active',
      options: [
        { label: 'Activa', value: 'true' },
        { label: 'Inactiva', value: 'false' },
      ],
    },
  ],
}
