import type { UnifiedSearchConfig } from '@/types/unified-search'

export const bankUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      serverParam: 'name',
      clientKey: ['name', 'code'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'is_active',
      label: 'Estado',
      serverParam: 'is_active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
}

export const paymentMethodUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'method_type',
      label: 'Categoría',
      serverParam: 'method_type',
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

export const treasuryAccountUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'account_type',
      label: 'Tipo',
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
