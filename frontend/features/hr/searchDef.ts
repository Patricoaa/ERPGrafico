import type { SearchDefinition } from '@/types/search'

export const employeeSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / RUT',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
}

export const absenceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'absence_type',
      label: 'Tipo',
      type: 'enum',
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
      type: 'daterange',
      serverParamStart: 'start_date_after',
      serverParamEnd: 'start_date_before',
    },
  ],
}

export const payrollSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Empleado',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Contabilizado', value: 'POSTED' },
      ],
    },
    {
      key: 'period_year',
      label: 'Año',
      type: 'text',
      serverParam: 'period_year',
    },
  ],
}

export const salaryAdvanceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'is_discounted',
      label: 'Estado',
      type: 'enum',
      serverParam: 'is_discounted',
      options: [
        { label: 'Descontado', value: 'true' },
        { label: 'Pendiente', value: 'false' },
      ],
    },
  ],
}
