import type { SegmentationDefinition } from '@/types/segmentation'

export const terminalPosSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Activas', value: 'ACTIVE' },
        { label: 'Inactivas', value: 'INACTIVE' },
      ],
    },
  ],
}

export const posSessionSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'status',
      options: [
        { label: 'Abierta', value: 'OPEN' },
        { label: 'En cierre', value: 'CLOSING' },
        { label: 'Cerrada', value: 'CLOSED' },
      ],
    },
  ],
}
