import type { SegmentationDefinition } from '@/types/segmentation'

export const fiscalYearSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'En Cierre', value: 'CLOSING' },
        { label: 'Cerrado', value: 'CLOSED' },
      ],
    },
  ],
}

export const accountSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'account_type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'account_type',
      options: [
        { label: 'Activo', value: 'ASSET' },
        { label: 'Pasivo', value: 'LIABILITY' },
        { label: 'Patrimonio', value: 'EQUITY' },
        { label: 'Ingresos', value: 'INCOME' },
        { label: 'Gastos', value: 'EXPENSE' },
        { label: 'Gastos Operacionales', value: 'OPERATING_EXPENSE' },
        { label: 'Gastos No Operacionales', value: 'NON_OPERATING_EXPENSE' },
        { label: 'Impuesto a la Renta', value: 'TAX_EXPENSE' },
        { label: 'Activo Corriente', value: 'CURRENT_ASSET' },
        { label: 'Activo No Corriente', value: 'NON_CURRENT_ASSET' },
        { label: 'Pasivo Corriente', value: 'CURRENT_LIABILITY' },
        { label: 'Pasivo No Corriente', value: 'NON_CURRENT_LIABILITY' },
      ],
    },
  ],
}

export const journalEntrySegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
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
}
