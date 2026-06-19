import type { SegmentationDefinition } from '@/types/segmentation'

export const salesOrderSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Facturado', value: 'INVOICED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'date',
      serverParamDate: 'date',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
    },
  ],
}

export const salesNoteSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'date',
      label: 'Fecha',
      type: 'date',
      serverParamDate: 'date',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
    },
  ],
}
