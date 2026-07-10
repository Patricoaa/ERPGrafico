import type { UnifiedSearchConfig } from '@/types/unified-search'

export const groupUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
}

export const jobUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Título / Error / Tipo',
      serverParam: 'search',
      clientKey: ['title', 'error_message', 'job_type_display'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Pendientes', value: 'PENDING' },
        { label: 'Procesando', value: 'PROCESSING' },
        { label: 'Completados', value: 'COMPLETED' },
        { label: 'Fallidos', value: 'FAILED' },
        { label: 'Cancelados', value: 'CANCELLED' },
      ],
    },
    {
      type: 'single',
      key: 'job_type',
      label: 'Tipo de Proceso',
      serverParam: 'job_type',
      options: [
        { label: 'Importación', value: 'IMPORT' },
        { label: 'Exportación', value: 'EXPORT' },
        { label: 'Reporte Pesado', value: 'REPORT' },
      ],
    },
  ],
}
