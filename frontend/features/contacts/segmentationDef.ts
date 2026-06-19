import type { SegmentationDefinition } from '@/types/segmentation'

export const contactSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'type',
      variant: 'dropdown',
      options: [
        { label: 'Cliente', value: 'CUSTOMER' },
        { label: 'Proveedor', value: 'SUPPLIER' },
        { label: 'Ambos', value: 'BOTH' },
        { label: 'Ninguno', value: 'NONE' },
      ],
    },
  ],
}
