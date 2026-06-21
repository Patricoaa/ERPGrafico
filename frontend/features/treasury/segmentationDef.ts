import type { SegmentationDefinition } from '@/types/segmentation'

export const treasuryAccountSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'account_type',
      label: 'Tipo',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'account_type',
      options: [
        { label: 'Caja Física (Efectivo)', value: 'CASH' },
        { label: 'Cuenta Bancaria', value: 'CHECKING' },
        { label: 'T. Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Préstamo Bancario', value: 'LOAN' },
        { label: 'Puente', value: 'BRIDGE' },
        { label: 'Cheques en Cartera', value: 'CHECK_PORTFOLIO' },
      ],
    },
  ],
}

export const terminalBatchSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      variant: 'dropdown',
      serverParam: 'status',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Liquidado', value: 'SETTLED' },
        { label: 'Conciliado', value: 'RECONCILED' },
        { label: 'Facturado', value: 'INVOICED' },
      ],
    },
  ],
}

export const deviceSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
        { label: 'Mantenimiento', value: 'MAINTENANCE' },
      ],
    },
  ],
}

export const bankSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'is_active',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'is_active',
      variant: 'dropdown',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
}

export const paymentMethodSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'method_type',
      label: 'Categoría',
      type: 'tabs',
      serverParam: 'method_type',
      variant: 'dropdown',
      options: [
        { label: 'Efectivo Directo', value: 'CASH' },
        { label: 'Tarjeta (Dispositivo)', value: 'CARD_TERMINAL' },
        { label: 'Transferencia Bancaria', value: 'TRANSFER' },
        { label: 'Tarjeta Débito Empresa', value: 'DEBIT_CARD' },
        { label: 'Tarjeta Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Cheque', value: 'CHECK' },
      ],
    },
  ],
}

export const treasuryMovementsSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'movement_type',
      label: 'Tipo',
      type: 'tabs',
      serverParam: 'movement_type',
      variant: 'dropdown',
      options: [
        { label: 'Depósito', value: 'INBOUND' },
        { label: 'Retiro', value: 'OUTBOUND' },
        { label: 'Traspaso', value: 'TRANSFER' },
        { label: 'Ajuste', value: 'ADJUSTMENT' },
      ],
    },
    {
      key: 'payment_method',
      label: 'Método de Pago',
      type: 'tabs',
      serverParam: 'payment_method',
      variant: 'dropdown',
      options: [
        { label: 'Efectivo', value: 'CASH' },
        { label: 'Tarjeta (Terminal)', value: 'CARD_TERMINAL' },
        { label: 'Tarjeta (Manual)', value: 'CARD' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Cheque', value: 'CHECK' },
        { label: 'Tarjeta Débito Empresa', value: 'DEBIT_CARD' },
        { label: 'Tarjeta Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Crédito', value: 'CREDIT' },
        { label: 'Castigo de Deuda', value: 'WRITE_OFF' },
        { label: 'Saldo a Favor', value: 'CREDIT_BALANCE' },
        { label: 'Otro', value: 'OTHER' },
      ],
    },
    {
      key: 'amount',
      label: 'Monto',
      type: 'range',
      serverParamFrom: 'amount_min',
      serverParamTo: 'amount_max',
      placeholderFrom: 'Mín',
      placeholderTo: 'Máx',
    },
  ],
}
