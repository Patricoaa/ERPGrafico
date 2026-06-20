import type { SegmentationDefinition } from '@/types/segmentation'

export const treasuryAccountSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'account_type',
      label: 'Tipo',
      type: 'tabs',
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
      type: 'tabs',
      serverParam: 'is_reconciled',
      options: [
        { label: 'Sí', value: 'true' },
        { label: 'No', value: 'false' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'date',
      serverParamFrom: 'date_from',
      serverParamTo: 'date_to',
    },
  ],
}
