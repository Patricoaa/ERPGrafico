import type { SearchDefinition } from '@/types/search'

export const userSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / Email / Usuario',
      type: 'text',
      serverParam: 'search',
      clientKey: ['username', 'email', 'first_name', 'last_name'],
    },
    {
      key: 'role',
      label: 'Rol',
      type: 'enum',
      serverParam: 'role',
      options: [
        { label: 'Admin', value: 'ADMIN' },
        { label: 'Gerente', value: 'MANAGER' },
        { label: 'Operador', value: 'OPERATOR' },
        { label: 'Lectura', value: 'READ_ONLY' },
      ],
    },
  ],
}
