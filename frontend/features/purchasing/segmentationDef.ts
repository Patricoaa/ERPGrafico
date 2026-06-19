import type { SegmentationDefinition } from '@/types/segmentation'

export const purchaseOrderSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Recibido', value: 'RECEIVED' },
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
