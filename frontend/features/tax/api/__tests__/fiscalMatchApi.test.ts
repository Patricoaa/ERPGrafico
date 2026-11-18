import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fiscalMatchApi } from '../fiscalMatchApi'

const get = vi.fn<(url: string, config?: { params?: URLSearchParams }) => Promise<{ data: unknown }>>()
vi.mock('@/lib/api', () => ({
    default: { get: (url: string, config?: { params?: URLSearchParams }): unknown => get(url, config) },
}))

beforeEach(() => {
    vi.clearAllMocks()
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
