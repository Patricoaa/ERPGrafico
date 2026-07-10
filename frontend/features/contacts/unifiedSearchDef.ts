import type { UnifiedSearchConfig } from '@/types/unified-search'

export const contactsUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / RUT / Email',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'role',
      label: 'Rol',
      serverParam: 'role',
      options: [
        { label: 'Cliente', value: 'CUSTOMER' },
        { label: 'Proveedor', value: 'SUPPLIER' },
        { label: 'Relacionado', value: 'RELATED' },
        { label: 'Socio', value: 'PARTNER' },
        { label: 'Empleado', value: 'EMPLOYEE' },
        { label: 'Usuario Sistema', value: 'USER' },
      ],
    },
  ],
  groupBy: [
    { key: 'contact_type', label: 'Tipo', field: 'contact_type' },
    { key: 'credit_risk_level', label: 'Riesgo', field: 'credit_risk_level' },
  ],
}
