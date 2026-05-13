import type { SearchDefinition } from '@/types/search'

export const productSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / SKU',
      type: 'text',
      serverParam: 'search',
      suggestionsUrl: 'inventory/products/filter-suggestions/',
    },
    {
      key: 'product_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'product_type',
      options: [
        { label: 'Almacenable', value: 'STORABLE' },
        { label: 'Consumible', value: 'CONSUMABLE' },
        { label: 'Servicio', value: 'SERVICE' },
        { label: 'Fabricable', value: 'MANUFACTURABLE' },
        { label: 'Suscripción', value: 'SUBSCRIPTION' },
      ],
    },
  ],
}
