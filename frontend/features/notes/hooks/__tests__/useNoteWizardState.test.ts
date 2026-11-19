import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteLineItem, NoteWizardSourceDocument } from '../../types'
import { useNoteWizardState } from '../useNoteWizardState'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const line = (over: Partial<NoteLineItem> = {}): NoteLineItem => ({
    lineId: 1,
    productId: 10,
    productName: 'Producto',
    originalQuantity: 5,
    noteQuantity: 0,
    noteUnitPrice: 1000,
    taxAmountPerUnit: 190,
    createsStockMove: true,
    ...over,
})

const source = (): NoteWizardSourceDocument => ({
    label: 'FACTURA 1',
    isExempt: false,
    originalTotal: 5950,
    lines: [line()],
})

const setup = () =>
    renderHook(() =>
        useNoteWizardState({
            open: true,
            mode: 'sales',
            initialType: 'NOTA_CREDITO',
            allowTypeChange: false,
            features: { logistics: true, manufacturing: false, reviewStep: false },
            serverDateString: '2026-11-19',
            fetchSource: async () => source(),
        }),
    )

describe('useNoteWizardState navigation', () => {
    it('no avanza desde "items" sin cantidades seleccionadas', async () => {
        const { result } = setup()
        await waitFor(() => expect(result.current.initializing).toBe(false))

        await act(async () => { await result.current.handleNext() })

        expect(result.current.currentStepId).toBe('items')
    })

    it('avanza al siguiente paso con una cantidad válida y agrega logística', async () => {
        const { result } = setup()
        await waitFor(() => expect(result.current.initializing).toBe(false))

        act(() => result.current.setLines(result.current.lines.map(l => ({ ...l, noteQuantity: 2 }))))
        await act(async () => { await result.current.handleNext() })

        expect(result.current.stepsSequence).toEqual(['items', 'logistics', 'registration', 'payment'])
        expect(result.current.currentStepId).toBe('logistics')
    })

    it('goToStep permite retroceder pero no saltar más de un paso', async () => {
        const { result } = setup()
        await waitFor(() => expect(result.current.initializing).toBe(false))
        act(() => result.current.setLines(result.current.lines.map(l => ({ ...l, noteQuantity: 2 }))))

        act(() => result.current.goToStep(3)) // salto largo: ignorado
        expect(result.current.currentStepId).toBe('items')

        act(() => result.current.goToStep(1)) // un paso adelante con items válidos
        expect(result.current.currentStepId).toBe('logistics')

        act(() => result.current.goToStep(0)) // retroceso libre
        expect(result.current.currentStepId).toBe('items')
    })

    it('goToStep hacia adelante respeta la validación del paso actual', async () => {
        const { result } = setup()
        await waitFor(() => expect(result.current.initializing).toBe(false))

        act(() => result.current.goToStep(1)) // sin cantidades
        expect(result.current.currentStepId).toBe('items')
    })

    it('conserva lo ingresado y no vuelve a pedir el documento al ocultar y mostrar (pestaña)', async () => {
        const fetchSource = vi.fn(async () => source())
        const { result, rerender } = renderHook(
            ({ open }) => useNoteWizardState({
                open,
                mode: 'sales',
                initialType: 'NOTA_CREDITO',
                allowTypeChange: false,
                features: { logistics: true, manufacturing: false, reviewStep: false },
                serverDateString: '2026-11-19',
                fetchSource,
            }),
            { initialProps: { open: true } },
        )
        await waitFor(() => expect(result.current.initializing).toBe(false))
        act(() => result.current.setLines(result.current.lines.map(l => ({ ...l, noteQuantity: 3 }))))

        rerender({ open: false })
        rerender({ open: true })

        expect(fetchSource).toHaveBeenCalledTimes(1)
        expect(result.current.lines[0].noteQuantity).toBe(3)
    })
})
