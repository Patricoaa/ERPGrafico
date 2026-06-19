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
