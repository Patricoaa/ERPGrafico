import type { SegmentationDefinition } from '@/types/segmentation'

export const checkSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'status',
      options: [
        { label: 'En Cartera', value: 'IN_PORTFOLIO' },
        { label: 'Depositado', value: 'DEPOSITED' },
        { label: 'Cobrado', value: 'CLEARED' },
        { label: 'Protestado', value: 'BOUNCED' },
        { label: 'Anulado', value: 'VOIDED' },
      ],
    },
    {
      key: 'due_date',
      label: 'Vencimiento',
      type: 'date',
      serverParamFrom: 'due_date_after',
      serverParamTo: 'due_date_before',
    },
  ],
}
