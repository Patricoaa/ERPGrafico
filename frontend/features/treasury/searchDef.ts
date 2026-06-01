import type { SearchDefinition } from '@/types/search'

export const treasuryAccountSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
    {
      key: 'account_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'account_type',
      options: [
        { label: 'Caja Física (Efectivo)', value: 'CASH' },
        { label: 'Cuenta Bancaria', value: 'CHECKING' },
        { label: 'T. Débito Empresa', value: 'DEBIT_CARD' },
        { label: 'T. Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Chequera / Instr.', value: 'CHECKBOOK' },
        { label: 'Puente', value: 'BRIDGE' },
        { label: 'Cta. Recaudadora', value: 'MERCHANT' },
      ],
    },
  ],
}

export const terminalBatchSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Liquidado', value: 'SETTLED' },
        { label: 'Conciliado', value: 'RECONCILED' },
        { label: 'Facturado', value: 'INVOICED' },
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

export const deviceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
        { label: 'Mantenimiento', value: 'MAINTENANCE' },
      ],
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
