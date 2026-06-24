import type { SegmentationDefinition } from '@/types/segmentation'

export const loanStatusSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'loan_status',
      label: 'Estado',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'loan_status',
      options: [
        { label: 'Activos', value: 'active' },
        { label: 'Finalizados', value: 'completed' },
      ],
    },
  ],
}
