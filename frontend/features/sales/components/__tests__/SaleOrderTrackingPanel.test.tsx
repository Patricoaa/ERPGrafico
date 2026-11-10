import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { SaleOrderTrackingPanel } from "../SaleOrderTrackingPanel"
import type { SaleTrackingEvent } from "../../types"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }))

const getOrderTracking = vi.fn<(id: number) => Promise<SaleTrackingEvent[]>>()
vi.mock("../../api/salesApi", () => ({ salesApi: { getOrderTracking: (id: number) => getOrderTracking(id) } }))

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return render(<SaleOrderTrackingPanel orderId={7} />, { wrapper })
}

const event = (over: Partial<SaleTrackingEvent>): SaleTrackingEvent => ({
    step: "CART", step_display: "Carrito", operator_name: "Ana Pérez", device_user_name: "Ana Pérez",
    entity_type: "", entity_id: null, detail: "", occurred_at: "2026-11-10T15:30:00Z", ...over,
})

describe("SaleOrderTrackingPanel", () => {
    beforeEach(() => { getOrderTracking.mockReset() })

    it("muestra paso, operador y cuenta del dispositivo cuando difiere", async () => {
        getOrderTracking.mockResolvedValue([
            event({}),
            event({ step: "PAYMENT", step_display: "Pago", operator_name: "Beto Soto", device_user_name: "Caja 1" }),
        ])
        renderPanel()
        expect(await screen.findByText("Carrito")).toBeTruthy()
        expect(screen.getByText("Pago")).toBeTruthy()
        expect(screen.getByText(/Beto Soto · caja de Caja 1/)).toBeTruthy()
        expect(screen.queryByText(/Ana Pérez · caja de/)).toBeNull()
    })

    it("muestra el estado de carga", () => {
        getOrderTracking.mockReturnValue(new Promise(() => undefined))
        renderPanel()
        expect(screen.getByRole("status", { name: "Cargando seguimiento" })).toBeTruthy()
    })

    it("muestra el estado vacío", async () => {
        getOrderTracking.mockResolvedValue([])
        renderPanel()
        expect(await screen.findByText("Sin seguimiento")).toBeTruthy()
    })

    it("muestra el error con opción de reintentar", async () => {
        getOrderTracking.mockImplementation(() => Promise.reject(new Error("boom")))
        renderPanel()
        expect(await screen.findByText("No se pudo cargar el seguimiento.")).toBeTruthy()
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy()
    })
})
