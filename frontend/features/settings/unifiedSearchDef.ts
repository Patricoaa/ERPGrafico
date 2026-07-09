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
