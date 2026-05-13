import type { SearchDefinition } from '@/types/search'

export const fiscalYearSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'year',
      label: 'Ejercicio',
      type: 'text',
      serverParam: 'year',
      clientKey: 'year',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'En Cierre', value: 'CLOSING' },
        { label: 'Cerrado', value: 'CLOSED' },
      ],
    },
  ],
}

export const taxPeriodSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'month_display',
      label: 'Período',
      type: 'text',
      serverParam: 'month_display',
      clientKey: ['month_display', 'year'],
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'Cerrado', value: 'CLOSED' },
        { label: 'En Revisión', value: 'UNDER_REVIEW' },
      ],
    },
  ],
}

export const accountSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cuenta / Código',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'account_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'account_type',
      options: [
        { label: 'Activo', value: 'ASSET' },
        { label: 'Pasivo', value: 'LIABILITY' },
        { label: 'Patrimonio', value: 'EQUITY' },
        { label: 'Ingresos', value: 'INCOME' },
        { label: 'Gastos', value: 'EXPENSE' },
        { label: 'Gastos Operacionales', value: 'OPERATING_EXPENSE' },
        { label: 'Gastos No Operacionales', value: 'NON_OPERATING_EXPENSE' },
        { label: 'Impuesto a la Renta', value: 'TAX_EXPENSE' },
        { label: 'Activo Corriente', value: 'CURRENT_ASSET' },
        { label: 'Activo No Corriente', value: 'NON_CURRENT_ASSET' },
        { label: 'Pasivo Corriente', value: 'CURRENT_LIABILITY' },
        { label: 'Pasivo No Corriente', value: 'NON_CURRENT_LIABILITY' },
      ],
    },
  ],
}

export const journalEntrySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Descripción',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Publicado', value: 'POSTED' },
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
