import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useFiscalMatchCounts,
    useFiscalMatches,
    useApplyFiscalMatch,
    useFiscalMatchSearch,
    useReleaseFiscalMatch,
} from '../useFiscalMatches'
import type { FiscalMatchChange } from '../../types/fiscalMatch'
import { useConfirmFiscalMatchDraft } from '../useFiscalMatchFeeding'

const list = vi.fn<(filters: unknown, page: number) => Promise<unknown>>()
const counts = vi.fn<(filters: unknown) => Promise<unknown>>()
const link = vi.fn<(id: number, changes: unknown, key: string) => Promise<unknown>>()
const search = vi.fn<(id: number, part: string, params: unknown, page: number) => Promise<unknown>>()
const confirmDraft = vi.fn<(id: number, invoiceId: number, key: string) => Promise<unknown>>()
const release = vi.fn<(id: number, key: string) => Promise<unknown>>()
const markLocalMutation = vi.fn()
const showApiError = vi.fn()

vi.mock('../../api/fiscalMatchApi', () => ({
    fiscalMatchApi: {
        list: (f: unknown, p: number): unknown => list(f, p),
        counts: (f: unknown): unknown => counts(f),
        apply: (id: number, c: unknown, k: string): unknown => link(id, c, k),
        search: (id: number, part: string, p: unknown, page: number): unknown => search(id, part, p, page),
        release: (id: number, k: string): unknown => release(id, k),
        confirmDraft: (id: number, inv: number, k: string): unknown => confirmDraft(id, inv, k),
    },
    applyErrorOf: (e: unknown) => {
        const index = (e as { changeIndex?: number }).changeIndex
        return typeof index === 'number' ? { code: 'X', changeIndex: index, message: 'x' } : null
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

const CHANGES: FiscalMatchChange[] = [{ op: 'link', part: 'rcv', id: 3 }]

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
        counts.mockResolvedValue({ by_status: {}, last_run_at: null, start_date: null })
        const { Wrapper, client } = setup()
        const { result } = renderHook(() => useFiscalMatchCounts({}), { wrapper: Wrapper })
        await waitFor(() => expect(result.current.counts).toBeDefined())
        expect(counts).toHaveBeenCalledWith({})
        const q = client.getQueryCache().findAll({ queryKey: ['fiscal-match', 'counts'] })[0]
        expect((q.observers[0].options as { refetchInterval?: unknown }).refetchInterval).toBe(60_000)
    })
})

describe('useFiscalMatchSearch', () => {
    const pageOf = (n: number, hasNext: boolean) => ({ results: [{ id: n }], count: 25, pageSize: 20, pageIndex: n, hasNextPage: hasNext, hasPrevPage: n > 1 })
    it('pagina en infinito: la siguiente página sale de hasNextPage y los items se acumulan', async () => {
        search.mockImplementation((_i, _p, _q, page) => Promise.resolve(pageOf(page, page === 1)))
        const { Wrapper } = setup()
        const { result } = renderHook(() => useFiscalMatchSearch(7, 'tuu', { q: 'abc', ordering: 'recent' }), { wrapper: Wrapper })
        await waitFor(() => expect(result.current.items).toHaveLength(1))
        expect(search).toHaveBeenCalledWith(7, 'tuu', { q: 'abc', ordering: 'recent' }, 1)
        expect(result.current.totalCount).toBe(25)
        expect(result.current.hasNextPage).toBe(true)
        await act(async () => { await result.current.fetchNextPage() })
        expect(search).toHaveBeenLastCalledWith(7, 'tuu', { q: 'abc', ordering: 'recent' }, 2)
        await waitFor(() => expect(result.current.items).toHaveLength(2))
        expect(result.current.hasNextPage).toBe(false)
    })
    it('conserva los resultados anteriores mientras carga otra búsqueda', async () => {
        search.mockImplementation((_i, _p, params) => (params as { q?: string }).q === 'b'
            ? new Promise(() => undefined)
            : Promise.resolve(pageOf(1, false)))
        const { Wrapper } = setup()
        const { result, rerender } = renderHook(({ q }) => useFiscalMatchSearch(7, 'rcv', { q }), { wrapper: Wrapper, initialProps: { q: 'a' } })
        await waitFor(() => expect(result.current.items).toHaveLength(1))
        rerender({ q: 'b' })
        await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
        expect(result.current.items).toHaveLength(1)
    })
    it('no consulta si enabled es false', () => {
        const { Wrapper } = setup()
        renderHook(() => useFiscalMatchSearch(7, 'erp', {}, false), { wrapper: Wrapper })
        expect(search).not.toHaveBeenCalled()
    })
})

describe('mutaciones', () => {
    it('apply envía Idempotency-Key, avisa al realtime e invalida cuadre, RCV y TUU', async () => {
        link.mockResolvedValue({})
        const { Wrapper, invalidate } = setup()
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 7, changes: CHANGES }) })
        expect(link).toHaveBeenCalledWith(7, CHANGES, expect.stringMatching(/^[0-9a-f-]{36}$/))
        expect(markLocalMutation).toHaveBeenCalled()
        const keys = invalidate.mock.calls.map(c => (c[0] as { queryKey: readonly unknown[] }).queryKey)
        expect(keys).toEqual([['fiscal-match'], ['accounting-rcv', 'documents'], ['terminal-sales']])
    })
    it('si el grupo resultante cambia de id, descarta el detalle viejo y no espera la invalidación', async () => {
        link.mockResolvedValue({ id: 9 })
        const { Wrapper, invalidate, client } = setup()
        client.setQueryData(['fiscal-match', 'detail', 7], { id: 7 })
        client.setQueryData(['fiscal-match', 'detail', 8], { id: 8 })
        let finish: () => void = () => undefined
        invalidate.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        // La promesa resuelve sin esperar la invalidación: la ficha sigue al nuevo grupo de inmediato.
        await act(async () => { await result.current.mutateAsync({ id: 7, changes: CHANGES }) })
        expect(client.getQueryData(['fiscal-match', 'detail', 7])).toBeUndefined()
        expect(client.getQueryData(['fiscal-match', 'detail', 8])).toEqual({ id: 8 })
        finish()
    })
    it('si el grupo cambia de id, descarta también las búsquedas del grupo viejo', async () => {
        link.mockResolvedValue({ id: 9 })
        const { Wrapper, client } = setup()
        client.setQueryData(['fiscal-match', 'search', 7, 'tuu', {}], { pages: [] })
        client.setQueryData(['fiscal-match', 'search', 8, 'tuu', {}], { pages: [] })
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 7, changes: CHANGES }) })
        expect(client.getQueryData(['fiscal-match', 'search', 7, 'tuu', {}])).toBeUndefined()
        expect(client.getQueryData(['fiscal-match', 'search', 8, 'tuu', {}])).toEqual({ pages: [] })
    })
    it('un 400 de apply con change_index no muestra el error genérico (lo muestra la ficha)', async () => {
        link.mockRejectedValue(Object.assign(new Error('bad'), { changeIndex: 0 }))
        const { Wrapper } = setup()
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 1, changes: CHANGES }).catch(() => undefined) })
        expect(showApiError).not.toHaveBeenCalled()
    })
    it('confirmar un borrador que disuelve el huérfano descarta su detalle viejo', async () => {
        confirmDraft.mockResolvedValue({ id: 9 })
        const { Wrapper, client } = setup()
        client.setQueryData(['fiscal-match', 'detail', 7], { id: 7 })
        const { result } = renderHook(() => useConfirmFiscalMatchDraft(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 7, invoiceId: 3 }) })
        expect(confirmDraft).toHaveBeenCalledWith(7, 3, expect.any(String))
        expect(client.getQueryData(['fiscal-match', 'detail', 7])).toBeUndefined()
    })
    it('si el grupo no cambia de id espera la invalidación', async () => {
        link.mockResolvedValue({ id: 7 })
        const { Wrapper, invalidate } = setup()
        const finishers: (() => void)[] = []
        const finish = () => finishers.forEach((f) => f())
        invalidate.mockImplementation(() => new Promise<void>((resolve) => { finishers.push(resolve) }))
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        let done = false
        const pending = result.current.mutateAsync({ id: 7, changes: CHANGES }).then(() => { done = true })
        await waitFor(() => expect(invalidate).toHaveBeenCalled())
        await Promise.resolve()
        expect(done).toBe(false)
        finish()
        await act(async () => { await pending })
        expect(done).toBe(true)
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
        const { result } = renderHook(() => useApplyFiscalMatch(), { wrapper: Wrapper })
        await act(async () => { await result.current.mutateAsync({ id: 1, changes: CHANGES }).catch(() => undefined) })
        expect(showApiError).toHaveBeenCalledWith(busy, 'No se pudo guardar el cuadre')
        expect(invalidate).not.toHaveBeenCalled()
    })
})
