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
      variant: 'dropdown',
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

export const journalEntrySegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      variant: 'dropdown',
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
