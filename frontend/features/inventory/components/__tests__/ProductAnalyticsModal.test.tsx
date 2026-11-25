import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
    capsById: {} as Record<number, unknown>,
}))

vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => ({ rate: 19, multiplier: 1.19, isLoading: false }) }))
vi.mock("../../hooks/useProducts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../hooks/useProducts")>()),
    useProductCapabilities: (id: number) => ({
        isLoading: false, isError: false, capabilities: state.capsById[id] ?? null,
    }),
}))
vi.mock("@/components/selectors", () => ({ ProductSelector: () => <div>selector-producto</div> }))
vi.mock("../../analytics/SubscriptionBlock", () => ({
    SubscriptionBlock: ({ productId }: { productId: number }) => <div>bloque-suscripcion-{productId}</div>,
}))
vi.mock("../../analytics/OverviewBlock", () => ({
    OverviewBlock: ({ onSelectTab }: { onSelectTab: (tab: string) => void }) => (
        <button type="button" onClick={() => onSelectTab("costs")}>ir-a-costos</button>
    ),
}))
vi.mock("../../analytics/ProductionBlock", () => ({
    ProductionBlock: ({ productId }: { productId: number }) => <div>bloque-produccion-{productId}</div>,
}))
vi.mock("../../analytics/StockBlock", () => ({ StockBlock: () => <div>bloque-inventario</div> }))
vi.mock("../../analytics/ProcurementBlock", () => ({ ProcurementBlock: () => <div>bloque-abastecimiento</div> }))
vi.mock("../../analytics/CostsBlock", () => ({ CostsBlock: () => <div>bloque-costos</div> }))
vi.mock("../../analytics/SalesBlock", () => ({ SalesBlock: () => <div>bloque-ventas</div> }))
vi.mock("../../analytics/PricingBlock", async () => {
    const { RailControls } = await import("../../analytics/RailControls")
    return {
        PricingBlock: ({ productId, period }: { productId: number; period: string }) => (
            <div data-period={period}>
                bloque-precio-margen-{productId}
                <RailControls><span>control-precio</span></RailControls>
            </div>
        ),
    }
})

import { ProductAnalyticsModal } from "../ProductAnalyticsModal"

const caps = (overrides: Record<string, unknown> = {}) => ({
    sells: false, buys: false, tracks_stock: false, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE", ...overrides,
})
const fullCaps = caps({ sells: true, buys: true, tracks_stock: true })
const inputCaps = caps({ buys: true, tracks_stock: true, used_in_production: true, segment: "INPUT" })

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})

const NAV = "Secciones de análisis de producto"
const rail = () => within(screen.getByRole("navigation", { name: NAV }))
const open = (productId = 1) =>
    render(<ProductAnalyticsModal productId={productId} productName="Tinta" open onOpenChange={() => {}} />)

describe("ProductAnalyticsModal", () => {
    beforeEach(() => {
        state.capsById = { 1: fullCaps, 2: inputCaps }
    })

    it("does not render the product name as modal description", () => {
        render(<ProductAnalyticsModal productId={1} productName="Tarjeta Doble Faz" open onOpenChange={() => {}} onProductChange={() => {}} />)
        const dialog = screen.getByRole("dialog")
        expect(dialog).not.toHaveAccessibleDescription("Tarjeta Doble Faz")
        expect(screen.queryByText("Tarjeta Doble Faz")).not.toBeInTheDocument()
    })

    it("shows the ProductSelector in the rail when onProductChange is provided", () => {
        render(<ProductAnalyticsModal productId={1} productName="Tarjeta Doble Faz" open onOpenChange={() => {}} onProductChange={() => {}} />)
        // rail slot (sm+) and compact row above the content (< sm)
        expect(screen.getAllByText("selector-producto")).toHaveLength(2)
        expect(screen.getByRole("navigation", { name: NAV })).toBeInTheDocument()
    })

    it("shows the product name in the rail when onProductChange is absent", () => {
        render(<ProductAnalyticsModal productId={1} productName="Tarjeta Doble Faz" open onOpenChange={() => {}} />)
        expect(screen.getAllByText("Tarjeta Doble Faz")).toHaveLength(2)
        expect(screen.queryByText("selector-producto")).not.toBeInTheDocument()
    })

    it("renders no tabs and loads no block until the capabilities are known", () => {
        state.capsById = {}
        open(1)
        expect(screen.queryByRole("navigation", { name: NAV })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Resumen" })).not.toBeInTheDocument()
        expect(screen.getByLabelText("Cargando insights del producto")).toBeInTheDocument()
    })

    it("shows the six tabs of a stocked product that is sold and bought", () => {
        open(1)
        for (const name of ["Resumen", "Ventas", "Precio", "Costos", "Abastecimiento", "Inventario"]) {
            expect(rail().getByRole("button", { name })).toBeInTheDocument()
        }
        for (const name of ["Producción", "Suscripción", "Clientes", "Proveedores", "Mov. Stock", "Operación"]) {
            expect(rail().queryByRole("button", { name })).not.toBeInTheDocument()
        }
    })

    it("shows production but no sales tabs for an input that is a BOM component", () => {
        open(2)
        expect(rail().queryByRole("button", { name: "Ventas" })).not.toBeInTheDocument()
        expect(rail().queryByRole("button", { name: "Precio" })).not.toBeInTheDocument()
        expect(rail().getByRole("button", { name: "Abastecimiento" })).toBeInTheDocument()
        expect(rail().getByRole("button", { name: "Producción" })).toBeInTheDocument()
    })

    it("shows only the overview for a product that neither sells, buys nor holds stock", () => {
        state.capsById = { 1: caps() }
        open(1)
        expect(rail().getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Resumen"])
    })

    it("shows the subscription tab for a recurring product", () => {
        state.capsById = { 1: caps({ recurring: true, segment: "SUBSCRIPTION" }) }
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Suscripción" }))
        expect(screen.getByText("bloque-suscripcion-1")).toBeInTheDocument()
    })

    it("falls back to overview when the active tab is no longer visible", () => {
        const view = open(1)
        fireEvent.click(rail().getByRole("button", { name: "Ventas" }))
        expect(rail().getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-current", "page")
        view.rerender(<ProductAnalyticsModal productId={2} productName="Tinta" open onOpenChange={() => {}} />)
        expect(rail().getByRole("button", { name: "Resumen" })).toHaveAttribute("aria-current", "page")
    })

    it("does not show the product segment anywhere", () => {
        open(2)
        for (const label of ["Insumo", "Almacenable", "Servicio", "Suscripción", "Consumible", "Fabricable con stock"]) {
            expect(screen.queryByText(label)).not.toBeInTheDocument()
        }
    })

    it("puts the period control in the rail with Histórico as the last option", () => {
        open(1)
        const groups = screen.getAllByRole("radiogroup", { name: "Período" })
        expect(groups).toHaveLength(2) // rail slot (sm+) and compact copy (< sm)
        const labels = within(groups[0]).getAllByRole("radio").map(r => r.textContent)
        expect(labels).toEqual(["1 m", "3 m", "6 m", "12 m", "24 m", "Histórico"])
        expect(within(groups[0]).getByRole("radio", { name: "12 m" })).toHaveAttribute("data-state", "on")
    })

    it("passes the chosen period to the active block", () => {
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Precio" }))
        expect(screen.getByText(/bloque-precio-margen-1/)).toHaveAttribute("data-period", "12m")
        fireEvent.click(screen.getAllByRole("radio", { name: "Histórico" })[0])
        expect(screen.getByText(/bloque-precio-margen-1/)).toHaveAttribute("data-period", "all")
    })

    it("never shows the legacy history warning", () => {
        state.capsById = { 1: caps({ sells: true, buys: true, tracks_stock: true, recurring: true }) }
        open(1)
        for (const name of ["Resumen", "Ventas", "Precio", "Costos", "Abastecimiento", "Inventario", "Suscripción"]) {
            fireEvent.click(rail().getByRole("button", { name }))
            expect(screen.queryByText("Este tab muestra todo el histórico")).not.toBeInTheDocument()
        }
    })

    it("opens a tab from the overview shortcut", () => {
        open(1)
        fireEvent.click(screen.getByRole("button", { name: "ir-a-costos" }))
        expect(rail().getByRole("button", { name: "Costos" })).toHaveAttribute("aria-current", "page")
    })

    it("shows the active tab's controls in the rail view zone and removes them when the tab changes", () => {
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Precio" }))
        const slots = screen.getAllByRole("group", { name: "Controles de vista" })
        expect(within(slots[0]).getByText("control-precio")).toBeInTheDocument()
        fireEvent.click(rail().getByRole("button", { name: "Ventas" }))
        expect(screen.queryByText("control-precio")).not.toBeInTheDocument()
    })

    it("mounts the production block only in the production tab", () => {
        state.capsById = { 1: caps({ manufactures: true, used_in_production: true, sells: true, segment: "MANUFACTURABLE_ON_DEMAND" }) }
        open(1)
        expect(screen.queryByText("bloque-produccion-1")).not.toBeInTheDocument()
        fireEvent.click(rail().getByRole("button", { name: "Producción" }))
        expect(screen.getByText("bloque-produccion-1")).toBeInTheDocument()
    })
})
