import type { UnifiedSearchConfig } from '@/types/unified-search'

export const accountUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Cuenta / Código',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'account_type',
      label: 'Tipo',
      serverParam: 'account_type',
      options: [
        { label: 'Activo', value: 'ASSET' },
        { label: 'Pasivo', value: 'LIABILITY' },
        { label: 'Patrimonio', value: 'EQUITY' },
        { label: 'Ingresos', value: 'INCOME' },
        { label: 'Gastos', value: 'EXPENSE' },
      ],
    },
  ],
}

export const journalEntryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Descripción', serverParam: 'search' },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Publicado', value: 'POSTED' },
        { label: 'Cerrado', value: 'CLOSED' },
        { label: 'Reversión', value: 'REVERSAL' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}

export const fiscalYearUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'year',
      label: 'Ejercicio',
      serverParam: 'year',
      clientKey: ['year'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'En Cierre', value: 'CLOSING' },
        { label: 'Cerrado', value: 'CLOSED' },
      ],
    },
  ],
}
