import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const uomUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / Abreviación',
      serverParam: 'search',
    },
  ],
}

export const categoryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
      clientKey: ['name', 'parent_name'],
    },
  ],
}

export const uomCategoryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
}

export const attributeUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
}

export const warehouseUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      serverParam: 'name',
      clientKey: ['name', 'code', 'address'],
    },
  ],
}

export const pricingRuleUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'active',
      label: 'Estado',
      serverParam: 'active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
    },
  ],
}

export const stockMoveUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'product_name',
      label: 'Producto',
      serverParam: 'product_name',
    },
  ],
  filters: [],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const subscriptionUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Producto',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Pausado', value: 'PAUSED' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'recurrence_period', label: 'Período', field: 'recurrence_period' },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const productUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / SKU',
      serverParam: 'search',
      suggestionsUrl: 'inventory/products/filter-suggestions/',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'product_type',
      label: 'Tipo',
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
      type: 'single',
      key: 'has_variants',
      label: 'Variantes',
      serverParam: 'has_variants',
      options: [
        { label: 'Con variantes', value: 'true' },
        { label: 'Sin variantes', value: 'false' },
      ],
    },
    {
      type: 'multi',
      key: 'availability',
      label: 'Disponible para',
      serverParam: 'availability',
      options: [
        { label: 'Venta', value: 'sale' },
        { label: 'Compra', value: 'purchase' },
      ],
    },
    {
      type: 'single',
      key: 'is_active',
      label: 'Estado',
      serverParam: 'is_active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
  groupBy: [
    { key: 'product_type', label: 'Tipo producto', field: 'product_type' },
    { key: 'category_name', label: 'Categoría', field: 'category_name' },
  ],
}

export const documentUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Buscar por Folio, referencia, contacto...',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Aprobado', value: 'APPROVED' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      type: 'single',
      key: 'document_type',
      label: 'Tipo',
      serverParam: 'document_type',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Recepción', value: 'RECEIPT' },
        { label: 'Entrega', value: 'DELIVERY' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Ajuste', value: 'ADJUSTMENT' },
        { label: 'Producción', value: 'PRODUCTION' },
      ],
    },
  ],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'document_type', label: 'Tipo documento', field: 'document_type' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
