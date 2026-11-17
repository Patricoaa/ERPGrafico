import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useFiscalMatchCounts,
    useFiscalMatches,
    useLinkFiscalMatch,
    useReleaseFiscalMatch,
} from '../useFiscalMatches'

const list = vi.fn<(filters: unknown, page: number) => Promise<unknown>>()
const counts = vi.fn<(filters: unknown) => Promise<unknown>>()
const link = vi.fn<(id: number, body: unknown, key: string) => Promise<unknown>>()
const release = vi.fn<(id: number, key: string) => Promise<unknown>>()
const markLocalMutation = vi.fn()
const showApiError = vi.fn()

vi.mock('../../api/fiscalMatchApi', () => ({
    fiscalMatchApi: {
        list: (f: unknown, p: number): unknown => list(f, p),
        counts: (f: unknown): unknown => counts(f),
        link: (id: number, b: unknown, k: string): unknown => link(id, b, k),
        release: (id: number, k: string): unknown => release(id, k),
    },
}))
vi.mock('@/features/realtime', () => ({ useRealtime: () => ({ markLocalMutation }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/errors', () => ({ showApiError: (e: unknown, m: string): void => { showApiError(e, m) } }))

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const Wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
    Wrapper.displayName = 'TestQueryWrapper'
    return { Wrapper, invalidate, client }
}

beforeEach(() => vi.clearAllMocks())

describe('queries', () => {
    it('lista con filtros y página', async () => {
        list.mockResolvedValue({ results: [], count: 0 })
        const { Wrapper } = setup()
        const { result } = renderHook(() => useFiscalMatches({ status: ['attention'] }, 2), { wrapper: Wrapper })
        await waitFor(() => expect(result.current.page).toBeDefined())
        expect(result.current.groups).toEqual([])
        expect(list).toHaveBeenCalledWith({ status: ['attention'] }, 2)
    })
    it('conteos con refetchInterval de 60 s', async () => {
        counts.mockResolvedValue({ by_status: {}, last_run_at: null })
        const { Wrapper, client } = setup()
        const { result } = renderHook(() => useFiscalMatchCounts({}), { wrapper: Wrapper })
        await waitFor(() => expect(result.current.counts).toBeDefined())
        expect(counts).toHaveBeenCalledWith({})
        const q = client.getQueryCache().findAll({ queryKey: ['fiscal-match', 'counts'] })[0]
        expect((q.observers[0].options as { refetchInterval?: unknown }).refetchInterval).toBe(60_000)
    })
})

describe('mutaciones', () => {
    it('link envía Idempotency-Key, avisa al realtime e invalida cuadre, RCV y TUU', async () => {
        link.mockResolvedValue({})
        const { Wrapper, invalidate } = setup()
        const { result } = renderHook(() => useLinkFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 7, body: { part: 'rcv', id: 3 } }) })
        expect(link).toHaveBeenCalledWith(7, { part: 'rcv', id: 3 }, expect.stringMatching(/^[0-9a-f-]{36}$/))
        expect(markLocalMutation).toHaveBeenCalled()
        const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: readonly unknown[] }).queryKey)
        expect(keys).toEqual([['fiscal-match'], ['accounting-rcv', 'documents'], ['terminal-sales']])
    })
    it('conserva la clave ante un fallo incierto y reintenta con la misma', async () => {
        release.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({})
        const { Wrapper } = setup()
        const { result } = renderHook(() => useReleaseFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 4 }).catch(() => undefined) })
        await act(async () => { await result.current.mutateAsync({ id: 4 }) })
        expect(release.mock.calls[1][1]).toBe(release.mock.calls[0][1])
    })
    it('un 409 muestra el error del servidor y no invalida', async () => {
        const busy = Object.assign(new Error('El cuadre está en curso'), { response: { status: 409 } })
        link.mockRejectedValue(busy)
        const { Wrapper, invalidate } = setup()
        const { result } = renderHook(() => useLinkFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 1, body: { part: 'erp', id: 2 } }).catch(() => undefined) })
        expect(showApiError).toHaveBeenCalledWith(busy, 'No se pudo cuadrar')
        expect(invalidate).not.toHaveBeenCalled()
    })
})
