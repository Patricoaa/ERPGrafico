import type { SearchDefinition } from '@/types/search'

export const employeeSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / RUT',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const salaryAdvanceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'employee_name',
      label: 'Empleado',
      type: 'text',
      serverParam: 'employee_name',
      clientKey: ['employee_name'],
    },
    {
      key: 'display_id',
      label: 'N° Anticipo',
      type: 'text',
      serverParam: 'display_id',
      clientKey: ['display_id'],
    },
  ],
}

export const absenceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'employee_name',
      label: 'Empleado',
      type: 'text',
      serverParam: 'employee_name',
      clientKey: ['employee_name'],
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
      key: 'period_year',
      label: 'Año',
      type: 'text',
      serverParam: 'period_year',
    },
  ],
}
