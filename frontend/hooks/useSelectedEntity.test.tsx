/**
 * Tests para useSelectedEntity (T-87 / F8)
 * Contrato: docs/20-contracts/list-modal-edit-pattern.md §2.3
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'sonner'
import { useSelectedEntity } from './useSelectedEntity'

// ---------------------------------------------------------------------------
// Mocks — hoisted at module level (vi.mock is auto-hoisted by Vitest)
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()
const mockGet = vi.fn()
const mockToString = vi.fn(() => '')

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => '/inventory/categories',
    useSearchParams: () => ({ get: mockGet, toString: mockToString }),
}))

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn() },
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Each test should get a fresh QueryClient to avoid cache bleeding
function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// Lazily import the mocked api instance after vi.mock has replaced it
let apiGetMock: ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
    vi.clearAllMocks()
    mockToString.mockReturnValue('')
    const { default: api } = await import('@/lib/api') as { default: { get: ReturnType<typeof vi.fn> } }
    apiGetMock = api.get
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSelectedEntity', () => {

    // ── 1. Sin param — sin fetch ──────────────────────────────────────────

    it('devuelve entity:null sin fetch cuando el param está ausente', () => {
        mockGet.mockReturnValue(null)

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        expect(result.current.entity).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(apiGetMock).not.toHaveBeenCalled()
    })

    // ── 2. Param presente — fetch exitoso ─────────────────────────────────

    it('fetchea la entidad cuando ?selected está presente y retorna entity', async () => {
        mockGet.mockReturnValue('42')
        apiGetMock.mockResolvedValueOnce({ data: { id: 42, name: 'Electrónica' } })

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        await waitFor(() => expect(result.current.entity).not.toBeNull())

        expect(result.current.entity).toEqual({ id: 42, name: 'Electrónica' })
        expect(apiGetMock).toHaveBeenCalledWith('/api/inventory/categories/42/')
        expect(result.current.isLoading).toBe(false)
    })

    // ── 3. Cache hit — no re-fetcha ───────────────────────────────────────
    // Usa un QueryClient compartido con staleTime: Infinity para que el segundo
    // subscriber use la cache sin re-fetch (comportamiento production equivalente
    // cuando la lista ya cargó el item en su propia query).

    it('reutiliza la cache si la entidad ya fue fetcheada (mismo queryKey)', async () => {
        mockGet.mockReturnValue('7')
        apiGetMock.mockResolvedValue({ data: { id: 7, name: 'Herramientas' } })

        // Shared QueryClient — staleTime: Infinity simula cache caliente
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children)

        // Primer hook — hace el fetch inicial
        const { result: r1 } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper }
        )
        await waitFor(() => expect(r1.current.entity).not.toBeNull())
        expect(apiGetMock).toHaveBeenCalledTimes(1)

        // Segundo hook — misma instancia de QueryClient con staleTime: Infinity
        // → datos no son stale → NO hace fetch adicional
        const { result: r2 } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper }
        )
        await waitFor(() => expect(r2.current.entity).not.toBeNull())

        // api.get debe haberse llamado exactamente 1 vez (no 2)
        expect(apiGetMock).toHaveBeenCalledTimes(1)
    })

    // ── 4. 404 → toast + clearSelection ──────────────────────────────────

    it('llama toast.error y clearSelection cuando el servidor retorna 404', async () => {
        mockGet.mockReturnValue('999')
        apiGetMock.mockRejectedValueOnce({ response: { status: 404 } })

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        await waitFor(() => expect(toast.error).toHaveBeenCalled())

        expect(toast.error).toHaveBeenCalledWith(
            'No encontrado',
            expect.objectContaining({ description: expect.any(String) })
        )
        // clearSelection → router.replace fue llamado
        expect(mockReplace).toHaveBeenCalled()
        expect(result.current.entity).toBeNull()
    })

    // ── 5. 403 → toast + redirect a base path ─────────────────────────────

    it('llama toast.error y redirige al path base cuando retorna 403', async () => {
        mockGet.mockReturnValue('55')
        apiGetMock.mockRejectedValueOnce({ response: { status: 403 } })

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        await waitFor(() => expect(toast.error).toHaveBeenCalled())

        expect(toast.error).toHaveBeenCalledWith(
            'Sin permiso',
            expect.objectContaining({ description: expect.any(String) })
        )
        // 403 → replace al pathname sin params (solo el pathname base)
        expect(mockReplace).toHaveBeenCalledWith(
            '/inventory/categories',
            expect.anything()
        )
        expect(result.current.entity).toBeNull()
    })

    // ── 6. clearSelection limpia el param preservando otros params ────────

    it('clearSelection elimina solo el param selected y preserva otros params', () => {
        mockGet.mockReturnValue(null)
        // Simula que la URL tiene page=2&filter=active&selected=10
        mockToString.mockReturnValue('page=2&filter=active&selected=10')

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        act(() => {
            result.current.clearSelection()
        })

        expect(mockReplace).toHaveBeenCalled()
        const calledUrl = mockReplace.mock.calls[0][0] as string
        // Debe contener los otros params pero NO 'selected'
        expect(calledUrl).toContain('page=2')
        expect(calledUrl).toContain('filter=active')
        expect(calledUrl).not.toContain('selected=')
    })

    // ── 7. paramName personalizado ────────────────────────────────────────

    it('usa el paramName personalizado para leer el query param', async () => {
        // Solo responde a 'active', no a 'selected'
        mockGet.mockImplementation((key: string) => key === 'active' ? '10' : null)
        apiGetMock.mockResolvedValueOnce({ data: { id: 10, name: 'Test' } })

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories', paramName: 'active' }),
            { wrapper: makeWrapper() }
        )

        await waitFor(() => expect(result.current.entity).not.toBeNull())
        expect(mockGet).toHaveBeenCalledWith('active')
        expect(apiGetMock).toHaveBeenCalledWith('/api/inventory/categories/10/')
    })

    // ── 8. isLoading false cuando no hay param ────────────────────────────

    it('isLoading es siempre false cuando no hay param selected', () => {
        mockGet.mockReturnValue(null)

        const { result } = renderHook(
            () => useSelectedEntity({ endpoint: '/api/inventory/categories' }),
            { wrapper: makeWrapper() }
        )

        expect(result.current.isLoading).toBe(false)
    })
})
