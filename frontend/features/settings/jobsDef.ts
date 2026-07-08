import type { SearchDefinition } from '@/types/search'
import type { SegmentationDefinition } from '@/types/segmentation'

export const jobSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Título / Error / Tipo',
      type: 'text',
      serverParam: 'search',
      clientKey: ['title', 'error_message', 'job_type_display'],
    },
  ],
}

export const jobSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      variant: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Pendientes', value: 'PENDING' },
        { label: 'Procesando', value: 'PROCESSING' },
        { label: 'Completados', value: 'COMPLETED' },
        { label: 'Fallidos', value: 'FAILED' },
        { label: 'Cancelados', value: 'CANCELLED' },
      ],
    },
    {
      key: 'job_type',
      label: 'Tipo de Proceso',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'job_type',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Importación', value: 'IMPORT' },
        { label: 'Exportación', value: 'EXPORT' },
        { label: 'Reporte Pesado', value: 'REPORT' },
      ],
    },
  ],
}
