import type { SegmentationDefinition } from '@/types/segmentation'

export const userSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'role',
      label: 'Rol',
      type: 'tabs',
      variant: 'dropdown',
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
