import type { SegmentationDefinition } from '@/types/segmentation'

export const workOrderSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'En Proceso', value: 'IN_PROGRESS' },
        { label: 'Terminada', value: 'FINISHED' },
        { label: 'Anulada', value: 'CANCELLED' },
      ],
    },
    {
      key: 'due_date',
      label: 'Fecha Entrega',
      type: 'date',
      serverParamDate: 'due_date',
      serverParamFrom: 'due_date_after',
      serverParamTo: 'due_date_before',
    },
  ],
}

export const bomSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'active',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'active',
      options: [
        { label: 'Activa', value: 'true' },
        { label: 'Inactiva', value: 'false' },
      ],
    },
  ],
}
