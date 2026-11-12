/**
 * Claves de socios. La raíz es la misma que `PARTNERS_KEYS.all` de `@/features/contacts`
 * (un test lo verifica); se declara aquí para no depender del orden de carga de módulos
 * circulares al construir el objeto.
 */
const ROOT = ['partners'] as const

export const PARTNER_KEYS = {
    all: ROOT,
    list: () => [...ROOT, 'list'] as const,
    statement: (contactId: number) => [...ROOT, 'statement', contactId] as const,
    stakes: (contactId: number) => [...ROOT, 'stakes', contactId] as const,
    evolution: (months: number, granularity: string) => [...ROOT, 'evolution', months, granularity] as const,
    distributions: () => [...ROOT, 'distributions'] as const,
    distribution: (id: number) => [...ROOT, 'distribution', id] as const,
    warehouses: () => [...ROOT, 'warehouses'] as const,
    product: (id: string) => [...ROOT, 'product', id] as const,
    uoms: (category: string) => [...ROOT, 'uoms', category] as const,
}
