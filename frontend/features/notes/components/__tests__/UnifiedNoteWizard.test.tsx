import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UnifiedNoteWizard } from '../UnifiedNoteWizard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/hooks/useVatRate', () => ({ useVatRate: () => ({ rate: 19, multiplier: 1.19, isLoading: false }) }))
vi.mock('@/hooks/useServerDate', () => ({ useServerDate: () => ({ dateString: '2026-11-19' }) }))

const fetchSource = async () => ({
    label: 'FACTURA 1',
    isExempt: false,
    originalTotal: 1190,
    lines: [{
        lineId: 1, productId: 10, productName: 'Tarjetas', originalQuantity: 5,
        noteQuantity: 0, noteUnitPrice: 1000, taxAmountPerUnit: 190,
    }],
})

describe('UnifiedNoteWizard', () => {
    it('muestra el contador del paso y bloquea "Siguiente" sin ítems seleccionados', async () => {
        render(
            <QueryClientProvider client={new QueryClient()}>
                <UnifiedNoteWizard
                    open
                    onOpenChange={() => {}}
                    mode="sales"
                    initialType="NOTA_CREDITO"
                    fetchSource={fetchSource}
                    onSubmit={async () => {}}
                    referenceLabel="1"
                />
            </QueryClientProvider>,
        )

        expect(await screen.findByText('Emitir Nota de Crédito')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('01 / 03')).toBeInTheDocument())

        await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))

        expect(screen.getByText('01 / 03')).toBeInTheDocument()
        expect(screen.queryByText('02 / 03')).not.toBeInTheDocument()
    })

    it('al seleccionar un producto en el primer paso le asigna cantidad y precio', async () => {
        render(
            <QueryClientProvider client={new QueryClient()}>
                <UnifiedNoteWizard
                    open
                    onOpenChange={() => {}}
                    mode="sales"
                    initialType="NOTA_CREDITO"
                    fetchSource={fetchSource}
                    onSubmit={async () => {}}
                    referenceLabel="1"
                />
            </QueryClientProvider>,
        )

        expect(await screen.findByText('Emitir Nota de Crédito')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('01 / 03')).toBeInTheDocument())

        // Checkbox de selección para "Tarjetas"
        const checkbox = screen.getByRole('checkbox', { name: /seleccionar tarjetas/i })
        expect(checkbox).toHaveAttribute('aria-checked', 'false')

        // Al marcar el checkbox, debe asignar la cantidad original y computar total con su precio
        await userEvent.click(checkbox)
        expect(checkbox).toHaveAttribute('aria-checked', 'true')

        // Input de cantidad debe tener 5 (originalQuantity)
        const qtyInput = screen.getByRole('spinbutton', { name: /cantidad de nota — tarjetas/i })
        expect(qtyInput).toHaveValue(5)
    })
})
