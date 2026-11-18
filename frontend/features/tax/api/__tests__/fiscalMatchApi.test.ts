import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyErrorOf, fiscalMatchApi } from '../fiscalMatchApi'

const get = vi.fn<(url: string, config?: { params?: URLSearchParams }) => Promise<{ data: unknown }>>()
const post = vi.fn<(url: string, body: unknown, config?: { headers?: Record<string, string> }) => Promise<{ data: unknown }>>()
vi.mock('@/lib/api', () => ({
    default: {
        get: (url: string, config?: { params?: URLSearchParams }): unknown => get(url, config),
        post: (url: string, body: unknown, config?: { headers?: Record<string, string> }): unknown => post(url, body, config),
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
    post.mockResolvedValue({ data: { id: 7 } })
    get.mockResolvedValue({ data: { results: [], count: 0, next: null, previous: null } })
})

describe('fiscalMatchApi filtros', () => {
    it('list envía direction en minúsculas y status repetido', async () => {
        await fiscalMatchApi.list({ direction: 'sale', status: ['PENDING', 'attention'] }, 2)
        const params = get.mock.calls[0][1]?.params as URLSearchParams
        expect(params.get('direction')).toBe('sale')
        expect(params.getAll('status')).toEqual(['PENDING', 'attention'])
        expect(params.get('page')).toBe('2')
    })
    it('counts envía direction=purchase', async () => {
        await fiscalMatchApi.counts({ direction: 'purchase' })
        expect((get.mock.calls[0][1]?.params as URLSearchParams).get('direction')).toBe('purchase')
    })
})

describe('fiscalMatchApi search/apply', () => {
    it('search envía part, q, ordering y página', async () => {
        const page = await fiscalMatchApi.search(7, 'rcv', { q: '1532', ordering: 'recent' }, 3)
        expect(get.mock.calls[0][0]).toBe('/tax/fiscal-matches/7/search/')
        const params = get.mock.calls[0][1]?.params as URLSearchParams
        expect(Object.fromEntries(params)).toEqual({ part: 'rcv', q: '1532', ordering: 'recent', page: '3' })
        expect(page.pageIndex).toBe(3)
    })
    it('search omite q vacío y ordering ausente', async () => {
        await fiscalMatchApi.search(7, 'erp', { q: '' }, 1)
        expect(Object.fromEntries(get.mock.calls[0][1]?.params as URLSearchParams)).toEqual({ part: 'erp', page: '1' })
    })
    it('apply envía {changes} con Idempotency-Key', async () => {
        const changes = [{ op: 'link', part: 'tuu', id: 4, movement: 9 }, { op: 'unlink', part: 'rcv', id: 2 }] as const
        await fiscalMatchApi.apply(7, [...changes], 'key-1')
        expect(post).toHaveBeenCalledWith('/tax/fiscal-matches/7/apply/', { changes }, { headers: { 'Idempotency-Key': 'key-1' } })
    })
})

describe('applyErrorOf', () => {
    it('extrae code, change_index y mensaje del sobre de error', () => {
        const error = { response: { status: 400, data: { error: { message: 'Monto distinto', code: 'AMOUNT_MISMATCH', details: { change_index: 1 }, timestamp: 't' } } } }
        expect(applyErrorOf(error)).toEqual({ code: 'AMOUNT_MISMATCH', changeIndex: 1, message: 'Monto distinto' })
    })
    it('null si no hay change_index o no es el sobre', () => {
        expect(applyErrorOf({ response: { data: { error: { message: 'x', code: 'BUSY', details: {} } } } })).toBeNull()
        expect(applyErrorOf(new Error('network'))).toBeNull()
    })
})
