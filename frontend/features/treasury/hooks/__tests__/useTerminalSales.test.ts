import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTerminalSales } from '../useTerminalSales'
import { useStartTerminalSync } from '../useTerminalSync'

const getTerminalSales = vi.fn<(params: unknown, signal?: AbortSignal) => Promise<unknown>>()
const startTerminalSync = vi.fn<(payload: unknown, key: string) => Promise<unknown>>()

vi.mock('../../api/treasuryApi', () => ({
    treasuryApi: {
        getTerminalSales: (params: unknown, signal?: AbortSignal): unknown => getTerminalSales(params, signal),
        startTerminalSync: (payload: unknown, key: string): unknown => startTerminalSync(payload, key),
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

describe('useTerminalSales', () => {
    it('arma los params de filtro y devuelve sales vacío por defecto', async () => {
        getTerminalSales.mockResolvedValue({ results: [], count: 0, pageSize: 50, pageIndex: 1, hasNextPage: false, hasPrevPage: false })
        const { result } = renderHook(
            () => useTerminalSales({ payment_type: 'DEBIT', document_type: 39, date_from: '2026-11-01', date_to: '2026-11-13' }),
            { wrapper: wrapper() },
        )
        expect(result.current.sales).toEqual([])
        await waitFor(() => expect(getTerminalSales).toHaveBeenCalled())
        expect(getTerminalSales.mock.calls[0][0]).toEqual({
            payment_type: 'DEBIT', document_type: 39, date_from: '2026-11-01', date_to: '2026-11-13', page: 1, page_size: 50,
        })
    })
})

describe('useStartTerminalSync', () => {
    it('envía una Idempotency-Key y la conserva ante un fallo incierto', async () => {
        startTerminalSync.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
        const { result } = renderHook(() => useStartTerminalSync(), { wrapper: wrapper() })
        await act(async () => { await result.current.startSync({ start_date: '2026-11-01' }).catch(() => undefined) })
        await act(async () => { await result.current.startSync({ start_date: '2026-11-01' }) })
        const [payload, key1] = startTerminalSync.mock.calls[0] as [unknown, string]
        expect(payload).toEqual({ start_date: '2026-11-01' })
        expect(key1).toMatch(/^[0-9a-f-]{36}$/)
        expect(startTerminalSync.mock.calls[1][1]).toBe(key1)
    })
})
