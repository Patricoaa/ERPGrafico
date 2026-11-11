import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { SessionOpenView } from "../SessionOpenView"

const openSession = vi.fn<(payload: Record<string, unknown>) => Promise<{ id: number }>>()
const joinSession = vi.fn<(id: number, mode: string) => Promise<{ id: number; my_mode: string }>>()
const getTerminals = vi.fn<() => Promise<unknown[]>>()
const openSessions = [{ id: 3, terminal: 2, treasury_account_name: "Caja 2", user_name: "Ana", opened_at: "2026-11-10T10:00:00Z", my_mode: "MULTI" }]

vi.mock("../../api/posApi", () => ({
    posApi: {
        getTerminals: () => getTerminals(),
        getSessions: vi.fn(() => Promise.resolve(openSessions)),
        getJustifyOptions: vi.fn().mockResolvedValue({
            reasons: { PARTNER_WITHDRAWAL: false, THEFT: true, ROUNDING: false },
            accounts: [
                { id: 5, name: "Caja 1 (propia)", account_type: "CASH", current_balance: 0 },
                { id: 7, name: "Caja fuerte", account_type: "CASH", current_balance: 900000 },
            ],
        }),
        openSession: (payload: Record<string, unknown>) => openSession(payload),
        joinSession: (id: number, mode: string) => joinSession(id, mode),
    },
}))
vi.mock("@/hooks/useTouchMode", () => ({ useTouchMode: () => ({ isTouchMode: false }) }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

function render(ui: ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

async function pickOpen(onSuccess = vi.fn()) {
    render(<SessionOpenView onSuccess={onSuccess} />)
    const openCard = await screen.findByRole("radio", { name: /Abrir Punto de Venta/ })
    await waitFor(() => expect(openCard.getAttribute("aria-disabled")).toBeNull())
    fireEvent.click(openCard)
    return onSuccess
}

describe("SessionOpenView", () => {
    beforeEach(() => {
        getTerminals.mockResolvedValue([
            { id: 1, name: "Caja 1", default_treasury_account: 5, default_treasury_account_balance: 0 },
        ])
        openSession.mockReset()
        openSession.mockResolvedValue({ id: 9 })
        joinSession.mockReset()
        joinSession.mockImplementation(async (id, mode) => ({ id, my_mode: mode }))
    })

    it("es una pantalla completa, no un diálogo, y ofrece salir del POS", async () => {
        render(<SessionOpenView onSuccess={vi.fn()} />)
        await screen.findByRole("radio", { name: /Abrir Punto de Venta/ })
        expect(screen.queryByRole("dialog")).toBeNull()
        expect(screen.getByRole("link", { name: /Salir/ }).getAttribute("href")).toBe("/")
    })

    it("con una sola caja libre salta directo al modo de caja con 'Un solo usuario' marcado", async () => {
        await pickOpen()
        await screen.findByRole("radiogroup", { name: "Modo de caja" })
        expect(screen.getByRole("radio", { name: /Un solo usuario/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /Multiusuario/ }).getAttribute("aria-checked")).toBe("false")
    })

    it("sin tocar nada, abre la sesión en modo SINGLE", async () => {
        const onSuccess = await pickOpen()
        // Modo de caja → Siguiente → Fondo inicial → Siguiente → Confirmar
        fireEvent.click(await screen.findByRole("button", { name: /Siguiente/ }))
        await screen.findByText("Fondo contado")
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(await screen.findByRole("button", { name: /Abrir caja/ }))
        await waitFor(() => expect(openSession).toHaveBeenCalled())
        expect(openSession.mock.calls[0]![0]).toMatchObject({ terminal_id: 1, mode: "SINGLE" })
        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 9 }, "open"))
    })

    it("tocar Multiusuario lo elige y avanza al fondo; abre en modo MULTI", async () => {
        await pickOpen()
        fireEvent.click(await screen.findByRole("radio", { name: /Multiusuario/ }))
        await screen.findByText("Fondo contado")
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(await screen.findByRole("button", { name: /Abrir caja/ }))
        await waitFor(() => expect(openSession).toHaveBeenCalled())
        expect(openSession.mock.calls[0]![0]).toMatchObject({ terminal_id: 1, mode: "MULTI" })
    })

    it("con varias cajas libres pide elegir el punto de venta en tarjetas", async () => {
        getTerminals.mockResolvedValue([
            { id: 1, name: "Caja 1", default_treasury_account: 5, default_treasury_account_balance: 0 },
            { id: 4, name: "Caja 4", default_treasury_account: 6, default_treasury_account_balance: 0 },
        ])
        await pickOpen()
        const group = await screen.findByRole("radiogroup", { name: "Punto de venta" })
        expect(group).toBeTruthy()
        fireEvent.click(screen.getByRole("radio", { name: /Caja 4/ }))
        await screen.findByRole("radiogroup", { name: "Modo de caja" })
    })

    it("si el fondo no cuadra, pide el motivo en su propio paso y la cuenta del traspaso en otro", async () => {
        getTerminals.mockResolvedValue([
            { id: 1, name: "Caja 1", default_treasury_account: 5, default_treasury_account_balance: 10000 },
        ])
        await pickOpen()
        fireEvent.click(await screen.findByRole("button", { name: /Siguiente/ })) // modo de caja
        await screen.findByText("Fondo contado")
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ })) // fondo 0 → falta 10.000
        await screen.findByRole("radiogroup", { name: "Motivo de la diferencia" })
        // Sin cuenta configurada, "Retiro Socio" no se ofrece
        expect(screen.queryByRole("radio", { name: /Retiro Socio/ })).toBeNull()
        expect(screen.getByRole("radio", { name: /Faltante \/ Robo/ })).toBeTruthy()
        fireEvent.click(screen.getByRole("radio", { name: /Traspaso/ }))
        const accounts = await screen.findByRole("radiogroup", { name: "Cuenta de destino" })
        expect(accounts).toBeTruthy()
        // La cuenta propia de la caja no es destino
        expect(screen.queryByRole("radio", { name: /Caja 1 \(propia\)/ })).toBeNull()
        fireEvent.click(screen.getByRole("radio", { name: /Caja fuerte/ }))
        fireEvent.click(await screen.findByRole("button", { name: /Abrir caja/ }))
        await waitFor(() => expect(openSession).toHaveBeenCalled())
        expect(openSession.mock.calls[0]![0]).toMatchObject({ opening_balance: 0, justify_reason: "TRANSFER", justify_target_id: 7 })
    })

    it("al unirse a una sesión existente, adopta el modo de la sesión sin solicitarlo", async () => {
        const onSuccess = vi.fn()
        render(<SessionOpenView onSuccess={onSuccess} />)
        const joinCard = await screen.findByRole("radio", { name: /Unirse a Punto de Venta/ })
        await waitFor(() => expect(joinCard.getAttribute("aria-disabled")).toBeNull())
        fireEvent.click(joinCard)
        fireEvent.click(await screen.findByRole("radio", { name: /Caja 2/ }))
        expect(screen.queryByRole("radiogroup", { name: "Modo de caja" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: /Unirse/ }))
        await waitFor(() => expect(joinSession).toHaveBeenCalledWith(3, "MULTI"))
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(onSuccess.mock.calls[0]![0]).toMatchObject({ id: 3, my_mode: "MULTI" })
        expect(onSuccess.mock.calls[0]![1]).toBe("join")
    })
})
