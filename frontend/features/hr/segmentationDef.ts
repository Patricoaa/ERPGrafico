import type { SegmentationDefinition } from '@/types/segmentation'

export const employeeSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
}

export const absenceSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'absence_type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'absence_type',
      options: [
        { label: 'Ausentismo', value: 'AUSENTISMO' },
        { label: 'Licencia Médica', value: 'LICENCIA' },
        { label: 'Permiso sin Goce', value: 'PERMISO_SIN_GOCE' },
        { label: 'Ausencia de Horas', value: 'AUSENCIA_HORAS' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha inicio',
      type: 'date',
      serverParamDate: 'start_date',
      serverParamFrom: 'start_date_after',
      serverParamTo: 'start_date_before',
    },
  ],
}

export const payrollSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Contabilizado', value: 'POSTED' },
      ],
    },
  ],
}

export const salaryAdvanceSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'is_discounted',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'is_discounted',
      options: [
        { label: 'Descontado', value: 'true' },
        { label: 'Pendiente', value: 'false' },
      ],
    },
  ],
}
