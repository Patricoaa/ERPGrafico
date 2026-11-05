import api from '@/lib/api'
import { toPage } from '@/lib/pagination'

/**
 * Límite de filas para catálogos (master data) que se consumen completos (ADR-0112).
 * El backend pagina solo si se pide `page_size`; aquí se pide hasta el límite.
 */
export const MASTER_DATA_LIMIT = 200

/** Lanzado cuando un catálogo tiene más filas que el límite: hay que filtrar, no truncar en silencio. */
export class BoundedListError extends Error {
    constructor(public readonly total: number) {
        super(`Hay ${total} registros; filtre la búsqueda para ver ${MASTER_DATA_LIMIT} o menos.`)
        this.name = 'BoundedListError'
    }
}

/** Lista acotada: todas las filas (≤ límite) o un error explícito si el catálogo es mayor. */
export async function fetchBoundedList<T>(url: string, params?: Record<string, string | number | boolean | undefined>): Promise<T[]> {
    const { data } = await api.get<unknown>(url, { params: { ...params, page_size: MASTER_DATA_LIMIT } })
    const page = toPage<T>(data, 1, MASTER_DATA_LIMIT)
    if (page.count > page.results.length) throw new BoundedListError(page.count)
    return page.results
}
