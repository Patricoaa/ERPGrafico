import type { SearchDefinition } from '@/types/search'

export const treasuryMovementsSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'movement_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'movement_type',
      options: [
        { label: 'Depósito', value: 'INBOUND' },
        { label: 'Retiro', value: 'OUTBOUND' },
        { label: 'Traspaso', value: 'TRANSFER' },
        { label: 'Ajuste', value: 'ADJUSTMENT' },
      ],
    },
    {
      key: 'is_reconciled',
      label: 'Conciliado',
      type: 'enum',
      serverParam: 'is_reconciled',
      options: [
        { label: 'Sí', value: 'true' },
        { label: 'No', value: 'false' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'daterange',
      serverParamStart: 'date_from',
      serverParamEnd: 'date_to',
    },
  ],
}
