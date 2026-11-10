import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SessionOpenModal } from "../SessionOpenModal"

const openSession = vi.fn<(payload: Record<string, unknown>) => Promise<{ id: number }>>()
const joinSession = vi.fn<(id: number, mode: string) => Promise<{ id: number; my_mode: string }>>()
const openSessions = [{ id: 3, terminal: 2, treasury_account_name: "Caja 2", user_name: "Ana", opened_at: "2026-11-10T10:00:00Z" }]

vi.mock("../../api/posApi", () => ({
    posApi: {
        getTerminals: vi.fn().mockResolvedValue([
            { id: 1, name: "Caja 1", default_treasury_account: 5, default_treasury_account_balance: 0 },
        ]),
        getSessions: vi.fn(() => Promise.resolve(openSessions)),
        getAccountingSettings: vi.fn().mockResolvedValue({ id: 1 }),
        getAccount: vi.fn().mockResolvedValue(null),
        openSession: (payload: Record<string, unknown>) => openSession(payload),
        joinSession: (id: number, mode: string) => joinSession(id, mode),
    },
}))
vi.mock("@/hooks/useTouchMode", () => ({ useTouchMode: () => ({ isTouchMode: false }) }))
vi.mock("@/components/selectors/TreasuryAccountSelector", () => ({ TreasuryAccountSelector: () => null }))

async function reachConfirmStep() {
    render(<SessionOpenModal open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    const openBtn = await screen.findByRole("button", { name: /Abrir Punto de Venta/ })
    // Se habilita cuando cargan las cajas libres
    await waitFor(() => expect((openBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(openBtn)
    // Fondo inicial → Continuar → Confirmar Apertura
    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }))
    await screen.findByRole("radiogroup", { name: "Modo de caja" })
}

describe("SessionOpenModal · modo de caja", () => {
    beforeEach(() => {
        openSession.mockReset()
        openSession.mockResolvedValue({ id: 9 })
        joinSession.mockReset()
        joinSession.mockImplementation(async (id, mode) => ({ id, my_mode: mode }))
    })

    it("ofrece los dos modos con 'Un solo usuario' marcado", async () => {
        await reachConfirmStep()
        expect(screen.getByRole("radio", { name: /Un solo usuario/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /Multiusuario/ }).getAttribute("aria-checked")).toBe("false")
    })

    it("sin tocar nada, abre la sesión en modo SINGLE", async () => {
        await reachConfirmStep()
        fireEvent.click(screen.getByRole("button", { name: /Confirmar Apertura/ }))
        await waitFor(() => expect(openSession).toHaveBeenCalled())
        expect(openSession.mock.calls[0]![0]).toMatchObject({ terminal_id: 1, mode: "SINGLE" })
    })

    it("al elegir Multiusuario, abre la sesión en modo MULTI", async () => {
        await reachConfirmStep()
        fireEvent.click(screen.getByRole("radio", { name: /Multiusuario/ }))
        fireEvent.click(screen.getByRole("button", { name: /Confirmar Apertura/ }))
        await waitFor(() => expect(openSession).toHaveBeenCalled())
        expect(openSession.mock.calls[0]![0]).toMatchObject({ terminal_id: 1, mode: "MULTI" })
    })

    it("al unirse a una sesión existente, el dispositivo elige su propio modo", async () => {
        const onSuccess = vi.fn()
        render(<SessionOpenModal open onOpenChange={vi.fn()} onSuccess={onSuccess} />)
        const joinBtn = await screen.findByRole("button", { name: /Unirse a Punto de Venta/ })
        await waitFor(() => expect((joinBtn as HTMLButtonElement).disabled).toBe(false))
        fireEvent.click(joinBtn)
        fireEvent.click(await screen.findByRole("button", { name: /Caja 2/ }))
        fireEvent.click(screen.getByRole("radio", { name: /Multiusuario/ }))
        fireEvent.click(screen.getByRole("button", { name: "Unirse" }))
        await waitFor(() => expect(joinSession).toHaveBeenCalledWith(3, "MULTI"))
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(onSuccess.mock.calls[0]![0]).toMatchObject({ id: 3, my_mode: "MULTI" })
        expect(onSuccess.mock.calls[0]![1]).toBe("join")
    })
})
