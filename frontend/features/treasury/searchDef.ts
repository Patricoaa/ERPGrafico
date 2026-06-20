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
  fields: [
    {
      key: 'batch_number',
      label: 'N° Liquidación',
      type: 'text',
      serverParam: 'batch_number',
      clientKey: ['batch_number'],
    },
    {
      key: 'provider_name',
      label: 'Proveedor',
      type: 'text',
      serverParam: 'provider_name',
      clientKey: ['provider_name'],
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
      key: 'search',
      label: 'Contacto / Referencia',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'display_id',
      label: 'Folio',
      type: 'text',
      serverParam: 'display_id',
    },
    {
      key: 'partner_name',
      label: 'Contacto',
      type: 'text',
      serverParam: 'partner_name',
    },
  ],
}
