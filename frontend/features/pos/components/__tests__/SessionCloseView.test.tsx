import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { POSSession } from "@/types/pos"
import { SessionCloseView } from "../SessionCloseView"

const closeSession = vi.fn<(id: number, payload: Record<string, unknown>) => Promise<unknown>>()

vi.mock("../../api/posApi", () => ({
    posApi: {
        getSessionSummary: vi.fn().mockResolvedValue({ expected_cash: 20000, session_id: 4 }),
        getJustifyOptions: vi.fn().mockResolvedValue({
            reasons: { PARTNER_WITHDRAWAL: true, THEFT: true, ROUNDING: true, OTHER_OUT: false },
            partners: [{ id: 21, name: "Ana Socia" }, { id: 22, name: "Beto Socio" }],
            accounts: [
                { id: 5, name: "Caja propia", account_type: "CASH", current_balance: 20000 },
                { id: 8, name: "Caja fuerte", account_type: "CASH", current_balance: 500000 },
                { id: 9, name: "Banco", account_type: "CHECKING", current_balance: 1 },
            ],
        }),
        closeSession: (id: number, payload: Record<string, unknown>) => closeSession(id, payload),
    },
}))
vi.mock("../../hooks/usePOSSessionRealtime", () => ({ usePOSSessionRealtime: () => undefined }))
vi.mock("@/hooks/useTouchMode", () => ({ useTouchMode: () => ({ isTouchMode: false }) }))

const session = {
    id: 4, terminal_name: "Caja Central", treasury_account: 5, expected_cash: 20000, my_mode: "SINGLE",
} as unknown as POSSession

function renderClose(onSuccess = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <SessionCloseView session={session} onSuccess={onSuccess} onCancel={vi.fn()} />
        </QueryClientProvider>,
    )
    return onSuccess
}

describe("SessionCloseView", () => {
    beforeEach(() => {
        closeSession.mockReset()
        closeSession.mockResolvedValue({ audit: { difference: "0" } })
    })

    it("con el conteo exacto y sin retiro, cierra sin pedir motivo", async () => {
        const onSuccess = renderClose()
        await screen.findByText("Efectivo contado")
        await waitFor(() => expect(screen.getAllByText("$20.000").length).toBeGreaterThan(0))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        // Efectivo: tocar "Dejar en la caja" avanza a confirmar
        fireEvent.click(await screen.findByRole("radio", { name: /Dejar en la caja/ }))
        fireEvent.click(await screen.findByRole("button", { name: /Cerrar caja/ }))
        await waitFor(() => expect(closeSession).toHaveBeenCalled())
        expect(closeSession.mock.calls[0]![1]).toMatchObject({ actual_cash: 20000, withdrawal_amount: 0, cash_destination_id: null })
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    })

    it("el traspaso elige monto y destino entre cajas y bancos, sin la caja propia", async () => {
        renderClose()
        await screen.findByText("Efectivo contado")
        await waitFor(() => expect(screen.getAllByText("$20.000").length).toBeGreaterThan(0))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(await screen.findByRole("radio", { name: /Traspasar/ }))
        await screen.findByText("Monto a traspasar")
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        await screen.findByRole("radiogroup", { name: "Cuenta de destino" })
        expect(screen.queryByRole("radio", { name: /Caja propia/ })).toBeNull()
        expect(screen.getByRole("radio", { name: /Banco/ })).toBeTruthy()
        fireEvent.click(screen.getByRole("radio", { name: /Caja fuerte/ }))
        fireEvent.click(await screen.findByRole("button", { name: /Cerrar caja/ }))
        await waitFor(() => expect(closeSession).toHaveBeenCalled())
        expect(closeSession.mock.calls[0]![1]).toMatchObject({ withdrawal_amount: 20000, withdrawal_kind: "TRANSFER", cash_destination_id: 8 })
    })

    it("el retiro pide motivo (solo los configurados) y no pide cuenta de destino", async () => {
        renderClose()
        await screen.findByText("Efectivo contado")
        await waitFor(() => expect(screen.getAllByText("$20.000").length).toBeGreaterThan(0))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(await screen.findByRole("radio", { name: /^Retirar/ }))
        await screen.findByRole("radiogroup", { name: "Motivo del retiro" })
        expect(screen.queryByRole("radio", { name: /Otro egreso/ })).toBeNull()
        fireEvent.click(screen.getByRole("radio", { name: /Retiro de socio/ }))
        // Retiro de socio: pregunta quién retira, y el monto va después
        await screen.findByRole("radiogroup", { name: "Socio que retira" })
        fireEvent.click(screen.getByRole("radio", { name: /Beto Socio/ }))
        await screen.findByText("Monto a retirar")
        fireEvent.click(screen.getByRole("button", { name: "C" }))
        for (const k of ["5", "0", "0", "0"]) fireEvent.click(screen.getByRole("button", { name: k }))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        await screen.findByText("Queda en la caja")
        fireEvent.click(screen.getByRole("button", { name: /Cerrar caja/ }))
        await waitFor(() => expect(closeSession).toHaveBeenCalled())
        expect(closeSession.mock.calls[0]![1]).toMatchObject({
            withdrawal_amount: 5000, withdrawal_kind: "PARTNER_WITHDRAWAL", withdrawal_partner_id: 22, cash_destination_id: null,
        })
    })
})
