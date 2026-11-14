import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRcvImports, useStartRcvImport } from '../useRcvImports'

const startImport = vi.fn<(payload: unknown, key: string) => Promise<unknown>>()
const getImports = vi.fn<(filters: unknown) => Promise<unknown>>()

vi.mock('../../api/rcvApi', () => ({
    rcvApi: {
        startImport: (payload: unknown, key: string): unknown => startImport(payload, key),
        getImports: (filters: unknown): unknown => getImports(filters),
    },
}))
vi.mock('@/features/realtime', () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const Wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
    Wrapper.displayName = 'TestQueryWrapper'
    return Wrapper
}

beforeEach(() => vi.clearAllMocks())

describe('useStartRcvImport', () => {
    it('envía una Idempotency-Key y la reutiliza al reintentar con el mismo payload', async () => {
        const payload = { year: 2026, month: 10, directions: ['PURCHASES' as const, 'SALES' as const] }
        startImport.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
        const { result } = renderHook(() => useStartRcvImport(), { wrapper: wrapper() })
        await act(async () => { await result.current.startImport(payload).catch(() => undefined) })
        await act(async () => { await result.current.startImport(payload) })
        const [sent, key1] = startImport.mock.calls[0] as [unknown, string]
        expect(sent).toEqual(payload)
        expect(key1).toMatch(/^[0-9a-f-]{36}$/)
        expect(startImport.mock.calls[1][1]).toBe(key1)
    })
})

describe('useRcvImports', () => {
    it('arma la paginación por defecto y expone las filas', async () => {
        getImports.mockResolvedValue({ results: [], count: 0, pageSize: 20, pageIndex: 1, hasNextPage: false, hasPrevPage: false })
        const { result } = renderHook(() => useRcvImports({ direction: 'SALES' }), { wrapper: wrapper() })
        await waitFor(() => expect(getImports).toHaveBeenCalled())
        expect(getImports.mock.calls[0][0]).toEqual({ direction: 'SALES', page: 1, page_size: 20 })
        expect(result.current.imports).toEqual([])
    })
})
