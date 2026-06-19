import type { SegmentationDefinition } from '@/types/segmentation'

export const posSessionSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Abierta', value: 'OPEN' },
        { label: 'En cierre', value: 'CLOSING' },
        { label: 'Cerrada', value: 'CLOSED' },
      ],
    },
  ],
}
