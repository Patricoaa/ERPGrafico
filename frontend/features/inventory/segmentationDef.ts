import type { SegmentationDefinition } from '@/types/segmentation'

export const stockMoveSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'move_type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'move_type',
      options: [
        { label: 'Entrada', value: 'IN' },
        { label: 'Salida', value: 'OUT' },
        { label: 'Ajuste', value: 'ADJ' },
      ],
    },
  ],
}

export const pricingRuleSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'active',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
    },
  ],
}

export const subscriptionSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Pausado', value: 'PAUSED' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
    },
  ],
}

export const productSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'product_type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'product_type',
      options: [
        { label: 'Almacenable', value: 'STORABLE' },
        { label: 'Consumible', value: 'CONSUMABLE' },
        { label: 'Servicio', value: 'SERVICE' },
        { label: 'Fabricable', value: 'MANUFACTURABLE' },
        { label: 'Suscripción', value: 'SUBSCRIPTION' },
      ],
    },
    {
      key: 'is_active',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'is_active',
      variant: 'dropdown',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
    {
      key: 'can_be_sold',
      label: 'Venta',
      type: 'tabs',
      serverParam: 'can_be_sold',
      variant: 'dropdown',
      options: [
        { label: 'Sí', value: 'true' },
        { label: 'No', value: 'false' },
      ],
    },
    {
      key: 'can_be_purchased',
      label: 'Compra',
      type: 'tabs',
      serverParam: 'can_be_purchased',
      variant: 'dropdown',
      options: [
        { label: 'Sí', value: 'true' },
        { label: 'No', value: 'false' },
      ],
    },
  ],
}
