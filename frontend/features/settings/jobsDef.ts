import type { SearchDefinition } from '@/types/search'

export const jobSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Título / Error / Tipo',
      type: 'text',
      serverParam: 'search',
      clientKey: ['title', 'error_message', 'job_type_display'],
    },
  ],
}
