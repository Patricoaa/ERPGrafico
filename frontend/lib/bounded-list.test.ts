import { describe, expect, it, vi, beforeEach } from 'vitest'

const { get } = vi.hoisted(() => ({
    get: vi.fn<(url: string, config: unknown) => Promise<{ data: unknown }>>(),
}))
vi.mock('@/lib/api', () => ({ default: { get } }))

import { BoundedListError, MASTER_DATA_LIMIT, fetchBoundedList } from './bounded-list'

const envelope = (count: number, results: unknown[]) => ({ count, next: null, previous: null, results })

describe('fetchBoundedList', () => {
    beforeEach(() => get.mockReset())

    it('pide hasta el límite y devuelve todas las filas cuando caben', async () => {
        get.mockResolvedValue({ data: envelope(2, [{ id: 1 }, { id: 2 }]) })

        const rows = await fetchBoundedList<{ id: number }>('/x/', { search: 'a', code: undefined })

        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
        expect(get).toHaveBeenCalledWith('/x/', { params: { search: 'a', code: undefined, page_size: MASTER_DATA_LIMIT } })
    })

    it('falla explícitamente si hay más registros que el límite (sin truncar en silencio)', async () => {
        get.mockResolvedValue({ data: envelope(MASTER_DATA_LIMIT + 5, Array.from({ length: MASTER_DATA_LIMIT }, (_, i) => ({ id: i }))) })

        await expect(fetchBoundedList('/x/')).rejects.toBeInstanceOf(BoundedListError)
    })

    it('rechaza respuestas que no son el envoltorio paginado', async () => {
        get.mockResolvedValue({ data: [{ id: 1 }] })

        await expect(fetchBoundedList('/x/')).rejects.toThrow(/envelope/)
    })
})
