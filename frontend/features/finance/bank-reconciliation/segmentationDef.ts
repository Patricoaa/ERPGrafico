import type { SegmentationDefinition } from '@/types/segmentation'

export const reconciliationSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'type',
      options: [
        { label: 'Abonos / Ingresos', value: 'IN' },
        { label: 'Cargos / Egresos', value: 'OUT' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'date',
      serverParamFrom: 'date_from',
      serverParamTo: 'date_to',
    },
  ],
}
