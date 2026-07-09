import type { UnifiedSearchConfig } from '@/types/unified-search'

export const employeeUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / RUT',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
}
