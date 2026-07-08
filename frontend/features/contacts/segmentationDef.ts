import type { SegmentationDefinition } from '@/types/segmentation'

export const contactSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'role',
      label: 'Rol',
      type: 'tabs',
      serverParam: 'role',
      variant: 'dropdown',
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
}
