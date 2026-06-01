import { SaleOrderFilters } from '../types'

/**
 * Hierarchical query-key factory para el dominio sales.
 *
 * Estructura:
 *   all          → ['sales']                              (raíz; invalidar cubre TODO)
 *   orders(...)  → ['sales', 'orders', { filters }]       (lista filtrada)
 *   order(id)    → ['sales', 'order', id]                 (detalle)
 *   notes(...)   → ['sales', 'notes', { filters }]        (notas de crédito/débito)
 *   deliveries(...) / delivery(id)                        (despachos)
 *   returns(...) / return(id)                             (devoluciones)
 *   posSessions / posSession(id)                          (cajas POS)
 *
 * Las mutaciones que afectan a una orden deben invalidar SALES_KEYS.all para
 * cubrir lista + detalle + notas + despachos + devoluciones del mismo padre.
 */
export const SALES_KEYS = {
    all: ['sales'] as const,
    orders: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'orders', { filters }] as const,
    order: (id: number) => [...SALES_KEYS.all, 'order', id] as const,
    notes: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'notes', { filters }] as const,
    deliveries: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'deliveries', { filters }] as const,
    delivery: (id: number) => [...SALES_KEYS.all, 'delivery', id] as const,
    returns: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'returns', { filters }] as const,
    return: (id: number) => [...SALES_KEYS.all, 'return', id] as const,
    posSessions: () => [...SALES_KEYS.all, 'posSessions'] as const,
    posSession: (id: number) => [...SALES_KEYS.all, 'posSession', id] as const,
}
