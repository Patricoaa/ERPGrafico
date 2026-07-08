import type { SearchDefinition } from '@/types/search'

export const checkSearchDef: SearchDefinition = {
  fields: [
    { key: 'check_number', label: 'N° Cheque', type: 'text', serverParam: 'check_number' },
    { key: 'drawer_name', label: 'Girador', type: 'text', serverParam: 'drawer_name' },
    { key: 'amount', label: 'Monto', type: 'text', serverParam: 'amount' },
  ],
}
