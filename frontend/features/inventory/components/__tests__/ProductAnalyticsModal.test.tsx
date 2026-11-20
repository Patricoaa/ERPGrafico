import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
    capsById: {} as Record<number, unknown>,
    production: { usage: [] as unknown[], history: [] as unknown[] },
}))

vi.mock("../../hooks/useProducts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../hooks/useProducts")>()),
    useProductCapabilities: (id: number) => ({
        isLoading: false, isError: false, capabilities: state.capsById[id] ?? null,
    }),
    useProductInsights: () => ({
        isLoading: false,
        insights: {
            price_history: [], stock_history: [], production_usage: state.production.usage, production_history: state.production.history,
            top_customers: [], top_suppliers: [],
            stock_flow: { totals: { in_qty: 0, in_cost: 0, out_qty: 0, out_cost: 0 }, monthly: [] },
            sales_analysis: { history: [], total_sold: 0, total_revenue: 0, total_cost_basis: 0 },
            purchase_analysis: { history: [], total_purchased: 0, total_cost: 0 },
        },
    }),
    useProduct: (id: number) => ({
        isLoading: false,
        product: { id, uom_name: "un", current_stock: 0, cost_price: 0, sale_price: 0, sale_price_gross: 0 },
    }),
}))
vi.mock("@/features/inventory/hooks/useStockMoves", () => ({ useStockMoves: () => ({ data: [], isLoading: false }) }))
vi.mock("@/components/selectors", () => ({ ProductSelector: () => <div>selector-producto</div> }))
vi.mock("@/features/_shared", () => ({ LazyDrawer: () => null }))
vi.mock("@/features/production", () => ({ WorkOrderWizard: () => null }))
vi.mock("../../analytics/SourcingBlock", () => ({
    SourcingBlock: ({ productId, section }: { productId: number; section?: string }) => (
        <div>bloque-abastecimiento-{section ?? "todo"}-{productId}</div>
    ),
}))
vi.mock("../../analytics/OperationsBlock", () => ({
    OperationsBlock: ({ productId }: { productId: number }) => <div>bloque-operacion-{productId}</div>,
}))
vi.mock("../../analytics/ProductionPerformanceBlock", () => ({
    ProductionPerformanceBlock: ({ productId }: { productId: number }) => <div>bloque-fabricacion-{productId}</div>,
}))
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
        state.production = { usage: [], history: [] }
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
        for (const name of ["Resumen", "Ventas", "Precio y margen", "Costos", "Abastecimiento", "Inventario"]) {
            expect(rail().getByRole("button", { name })).toBeInTheDocument()
        }
        for (const name of ["Producción", "Suscripción", "Clientes", "Proveedores", "Mov. Stock", "Operación"]) {
            expect(rail().queryByRole("button", { name })).not.toBeInTheDocument()
        }
    })

    it("shows production but no sales tabs for an input that is a BOM component", () => {
        open(2)
        expect(rail().queryByRole("button", { name: "Ventas" })).not.toBeInTheDocument()
        expect(rail().queryByRole("button", { name: "Precio y margen" })).not.toBeInTheDocument()
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
        expect(screen.getByText("bloque-operacion-1")).toBeInTheDocument()
    })

    it("falls back to overview when the active tab is no longer visible", () => {
        const view = open(1)
        fireEvent.click(rail().getByRole("button", { name: "Ventas" }))
        expect(rail().getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-current", "page")
        view.rerender(<ProductAnalyticsModal productId={2} productName="Tinta" open onOpenChange={() => {}} />)
        expect(rail().getByRole("button", { name: "Resumen" })).toHaveAttribute("aria-current", "page")
    })

    it("sums the monthly production history, not the truncated recent-usage list, for Consumo en OT", () => {
        state.production = {
            usage: [{ date: "2026-01-01", ot_id: 1, ot_number: "OT-1", quantity: 1, description: "x" }],
            history: [{ month: "2026-01", qty: 20 }, { month: "2026-02", qty: 15 }],
        }
        open(2)
        expect(screen.getByText("Consumo en OT")).toBeInTheDocument()
        expect(screen.getByText(/^35\s*un$/)).toBeInTheDocument()
    })

    it("does not show the product segment anywhere", () => {
        open(2)
        for (const label of ["Insumo", "Almacenable", "Servicio", "Suscripción", "Consumible", "Fabricable con stock"]) {
            expect(screen.queryByText(label)).not.toBeInTheDocument()
        }
    })

    it("puts the period control in the rail with Histórico as the last option", () => {
        open(1)
        const groups = screen.getAllByRole("group", { name: "Período" })
        expect(groups).toHaveLength(2) // rail slot (sm+) and compact copy (< sm)
        const labels = within(groups[0]).getAllByRole("radio").map(r => r.textContent)
        expect(labels).toEqual(["1 m", "3 m", "6 m", "12 m", "24 m", "Histórico"])
        expect(within(groups[0]).getByRole("radio", { name: "12 m" })).toHaveAttribute("data-state", "on")
    })

    it("passes the chosen period to the active block", () => {
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Precio y margen" }))
        expect(screen.getByText(/bloque-precio-margen-1/)).toHaveAttribute("data-period", "12m")
        fireEvent.click(screen.getAllByRole("radio", { name: "Histórico" })[0])
        expect(screen.getByText(/bloque-precio-margen-1/)).toHaveAttribute("data-period", "all")
    })

    it("warns that tabs with legacy content show the whole history, until the period is Histórico", () => {
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Ventas" }))
        expect(screen.getByText("Este tab muestra todo el histórico")).toBeInTheDocument()
        fireEvent.click(screen.getAllByRole("radio", { name: "Histórico" })[0])
        expect(screen.queryByText("Este tab muestra todo el histórico")).not.toBeInTheDocument()
    })

    it("does not show the legacy warning on the subscription tab", () => {
        state.capsById = { 1: caps({ recurring: true, segment: "SUBSCRIPTION" }) }
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Suscripción" }))
        expect(screen.queryByText("Este tab muestra todo el histórico")).not.toBeInTheDocument()
    })

    it("shows the active tab's controls in the rail view zone and removes them when the tab changes", () => {
        open(1)
        fireEvent.click(rail().getByRole("button", { name: "Precio y margen" }))
        const slots = screen.getAllByRole("group", { name: "Controles de vista" })
        expect(within(slots[0]).getByText("control-precio")).toBeInTheDocument()
        fireEvent.click(rail().getByRole("button", { name: "Ventas" }))
        expect(screen.queryByText("control-precio")).not.toBeInTheDocument()
    })

    it("mounts the manufacturing and input-usage blocks only in the production tab", () => {
        state.capsById = { 1: caps({ manufactures: true, buys: true, used_in_production: true, sells: true, segment: "MANUFACTURABLE_ON_DEMAND" }) }
        open(1)
        expect(screen.queryByText("bloque-fabricacion-1")).not.toBeInTheDocument()
        fireEvent.click(rail().getByRole("button", { name: "Producción" }))
        expect(screen.getByText("bloque-fabricacion-1")).toBeInTheDocument()
        expect(screen.getByText("bloque-abastecimiento-used_in-1")).toBeInTheDocument()
        expect(screen.queryByText("bloque-abastecimiento-make_vs_buy-1")).not.toBeInTheDocument()
    })
})
