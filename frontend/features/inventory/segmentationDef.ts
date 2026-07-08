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

export const stockReportSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'stock_qty',
      label: 'Stock (Físico)',
      type: 'range',
      serverParamFrom: 'stock_qty_from',
      serverParamTo: 'stock_qty_to',
    },
    {
      key: 'qty_available',
      label: 'Disponible',
      type: 'range',
      serverParamFrom: 'qty_available_from',
      serverParamTo: 'qty_available_to',
    },
    {
      key: 'qty_reserved',
      label: 'Reservado',
      type: 'range',
      serverParamFrom: 'qty_reserved_from',
      serverParamTo: 'qty_reserved_to',
    },
    {
      key: 'total_value',
      label: 'Valorización',
      type: 'range',
      serverParamFrom: 'total_value_from',
      serverParamTo: 'total_value_to',
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
      variant: 'dropdown',
      options: [
        { label: 'Almacenable', value: 'STORABLE' },
        { label: 'Consumible', value: 'CONSUMABLE' },
        { label: 'Servicio', value: 'SERVICE' },
        { label: 'Fabricable', value: 'MANUFACTURABLE' },
        { label: 'Suscripción', value: 'SUBSCRIPTION' },
      ],
    },
    {
      key: 'has_variants',
      label: 'Variantes',
      type: 'tabs',
      serverParam: 'has_variants',
      variant: 'dropdown',
      options: [
        { label: 'Con variantes', value: 'true' },
        { label: 'Sin variantes', value: 'false' },
      ],
    },
    {
      key: 'availability',
      label: 'Disponible para',
      type: 'multiselect',
      serverParam: 'availability',
      options: [
        { label: 'Venta', value: 'sale' },
        { label: 'Compra', value: 'purchase' },
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
  ],
}
