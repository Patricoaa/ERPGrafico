import type { SegmentationDefinition } from '@/types/segmentation'

export const creditContactSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'risk_level',
      label: 'Riesgo',
      type: 'tabs',
      serverParam: 'risk_level',
      options: [
        { label: 'Bajo', value: 'LOW' },
        { label: 'Medio', value: 'MEDIUM' },
        { label: 'Alto', value: 'HIGH' },
        { label: 'Crítico', value: 'CRITICAL' },
      ],
    },
  ],
}

export const creditHistorySegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'origin',
      label: 'Origen',
      type: 'tabs',
      serverParam: 'origin',
      options: [
        { label: 'Manual', value: 'MANUAL' },
        { label: 'Venta', value: 'SALE' },
        { label: 'Ajuste', value: 'ADJUSTMENT' },
        { label: 'Reversión', value: 'REVERSAL' },
      ],
    },
  ],
}
