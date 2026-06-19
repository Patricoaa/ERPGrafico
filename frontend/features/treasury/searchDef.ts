import type { SearchDefinition } from '@/types/search'

export const treasuryAccountSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
  ],
}

export const terminalBatchSearchDef: SearchDefinition = {
  fields: [],
}

export const deviceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const bankSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      type: 'text',
      serverParam: 'name',
      clientKey: ['name', 'code'],
    },
  ],
}

export const paymentMethodSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
    {
      key: 'method_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'method_type',
      options: [
        { label: 'Efectivo Directo', value: 'CASH' },
        { label: 'Tarjeta (Dispositivo)', value: 'CARD_TERMINAL' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Tarjeta Débito', value: 'DEBIT_CARD' },
        { label: 'Tarjeta Crédito', value: 'CREDIT_CARD' },
        { label: 'Cheque', value: 'CHECK' },
      ],
    },
  ],
}

export const providerSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
  ],
}

export const treasuryMovementsSearchDef: SearchDefinition = {
  fields: [],
}
