import { createQueryKeyFactory } from '@/lib/query-keys'

export const INVOICES_KEYS = createQueryKeyFactory('invoices')
export const PURCHASE_INVOICES_KEYS = createQueryKeyFactory('purchase-invoices')

// Backward-compatible aliases — existing code uses these
export const INVOICES_QUERY_KEY = INVOICES_KEYS.all
export const PURCHASE_INVOICES_QUERY_KEY = PURCHASE_INVOICES_KEYS.all
