import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRcvImport, useRcvImports, useStartRcvImport } from '../useRcvImports'
import { RCV_KEYS } from '../queryKeys'

const startImport = vi.fn<(payload: unknown, key: string) => Promise<unknown>>()
const getImports = vi.fn<(filters: unknown) => Promise<unknown>>()
const getImport = vi.fn<(id: number) => Promise<unknown>>()

vi.mock('../../api/rcvApi', () => ({
    rcvApi: {
        startImport: (payload: unknown, key: string): unknown => startImport(payload, key),
        getImports: (filters: unknown): unknown => getImports(filters),
        getImport: (id: number): unknown => getImport(id),
    },
}))
vi.mock('@/features/realtime', () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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

function page(status: string) {
    return { results: [{ id: 4, status }], count: 1, pageSize: 20, pageIndex: 1, hasNextPage: false, hasPrevPage: false }
}

function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): unknown[] {
    return spy.mock.calls.map(([arg]) => (arg as { queryKey: unknown }).queryKey)
}

const REFRESHED = [RCV_KEYS.documents(), RCV_KEYS.apiKeys(), RCV_KEYS.settings()]

describe('refresco al terminar una importación', () => {
    it('useRcvImports invalida documentos, API keys y configuración al pasar a terminada', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidate = vi.spyOn(client, 'invalidateQueries')
        getImports.mockResolvedValueOnce(page('RUNNING'))
        const { result } = renderHook(() => useRcvImports(), { wrapper: wrapper(client) })
        await waitFor(() => expect(result.current.imports[0]?.status).toBe('RUNNING'))
        expect(invalidate).not.toHaveBeenCalled()

        getImports.mockResolvedValueOnce(page('SUCCESS'))
        await act(async () => { await result.current.refetch() })
        await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual(REFRESHED))

        getImports.mockResolvedValueOnce(page('SUCCESS'))
        await act(async () => { await result.current.refetch() })
        expect(invalidate).toHaveBeenCalledTimes(REFRESHED.length)
    })

    it('useRcvImports no invalida si la importación ya venía terminada', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidate = vi.spyOn(client, 'invalidateQueries')
        getImports.mockResolvedValue(page('FAILED'))
        const { result } = renderHook(() => useRcvImports(), { wrapper: wrapper(client) })
        await waitFor(() => expect(result.current.imports).toHaveLength(1))
        await act(async () => { await result.current.refetch() })
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('useRcvImport invalida al pasar de en cola a fallida', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidate = vi.spyOn(client, 'invalidateQueries')
        getImport.mockResolvedValueOnce({ id: 4, status: 'QUEUED' })
        const { result } = renderHook(() => useRcvImport(4), { wrapper: wrapper(client) })
        await waitFor(() => expect(result.current.rcvImport?.status).toBe('QUEUED'))

        getImport.mockResolvedValueOnce({ id: 4, status: 'FAILED' })
        await act(async () => { await result.current.refetch() })
        await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual(REFRESHED))
    })
})
