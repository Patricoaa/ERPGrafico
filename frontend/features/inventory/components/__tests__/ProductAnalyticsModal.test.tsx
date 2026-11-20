import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
    capsById: {
        1: {
            sells: true, buys: true, tracks_stock: true, manufactures: false, express: false,
            recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
        },
    } as Record<number, unknown>,
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
    SourcingBlock: ({ productId }: { productId: number }) => <div>bloque-abastecimiento-{productId}</div>,
}))
vi.mock("../../analytics/OperationsBlock", () => ({
    OperationsBlock: ({ productId }: { productId: number }) => <div>bloque-operacion-{productId}</div>,
}))
vi.mock("../../analytics/ProductionPerformanceBlock", () => ({
    ProductionPerformanceBlock: ({ productId }: { productId: number }) => <div>bloque-fabricacion-{productId}</div>,
}))
vi.mock("../../analytics/SalesImpactBlock", () => ({
    SalesImpactBlock: ({ productId }: { productId: number }) => <div>bloque-precio-margen-{productId}</div>,
}))

import { ProductAnalyticsModal } from "../ProductAnalyticsModal"

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})

describe("ProductAnalyticsModal", () => {
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
        expect(screen.getByRole("navigation", { name: "Secciones de análisis de producto" })).toBeInTheDocument()
    })

    it("shows the product name in the rail when onProductChange is absent", () => {
        render(<ProductAnalyticsModal productId={1} productName="Tarjeta Doble Faz" open onOpenChange={() => {}} />)
        expect(screen.getAllByText("Tarjeta Doble Faz")).toHaveLength(2)
        expect(screen.queryByText("selector-producto")).not.toBeInTheDocument()
    })
})


const fullCaps = {
    sells: true, buys: true, tracks_stock: true, manufactures: false, express: false,
    recurring: false, used_in_production: false, has_variants: false, segment: "STORABLE",
}
const inputCaps = { ...fullCaps, sells: false, used_in_production: true, segment: "INPUT" }

describe("ProductAnalyticsModal capabilities", () => {
    beforeEach(() => {
        state.capsById = { 1: fullCaps, 2: inputCaps }
        state.production = { usage: [], history: [] }
    })

    const open = (productId = 1) =>
        render(<ProductAnalyticsModal productId={productId} productName="Tinta" open onOpenChange={() => {}} />)

    it("hides sales tabs and shows production for an input-only product", () => {
        open(2)
        expect(screen.queryByRole("button", { name: "Ventas" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Clientes" })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Compras" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Producción" })).toBeInTheDocument()
    })

    it("shows the stock tab only when the product tracks stock", () => {
        state.capsById = { 1: { ...fullCaps, tracks_stock: false } }
        open(1)
        expect(screen.queryByRole("button", { name: "Mov. Stock" })).not.toBeInTheDocument()
    })

    it("shows the segment label in the rail", () => {
        open(2)
        expect(screen.getAllByText("Insumo").length).toBeGreaterThan(0)
    })

    it("falls back to overview when the active tab is no longer visible", () => {
        const view = render(<ProductAnalyticsModal productId={1} productName="Tinta" open onOpenChange={() => {}} />)
        fireEvent.click(screen.getByRole("button", { name: "Ventas" }))
        expect(screen.getByRole("button", { name: "Ventas" })).toHaveAttribute("aria-current", "page")
        view.rerender(<ProductAnalyticsModal productId={2} productName="Tinta" open onOpenChange={() => {}} />)
        expect(screen.getByRole("button", { name: "Resumen" })).toHaveAttribute("aria-current", "page")
    })

    it("renders no tabs and loads no block until the capabilities are known", () => {
        state.capsById = {}
        open(1)
        expect(screen.queryByRole("navigation", { name: "Secciones de análisis de producto" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Resumen" })).not.toBeInTheDocument()
        expect(screen.getByLabelText("Cargando insights del producto")).toBeInTheDocument()
    })

    it("renders every applicable tab once the capabilities are known", () => {
        open(1)
        const rail = within(screen.getByRole("navigation", { name: "Secciones de análisis de producto" }))
        for (const name of ["Resumen", "Ventas", "Compras", "Precio", "Costos", "Mov. Stock", "Clientes", "Proveedores"]) {
            expect(rail.getByRole("button", { name })).toBeInTheDocument()
        }
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

    it("shows the Precio y margen tab for a sellable product and mounts its block only when active", () => {
        open(1)
        expect(screen.queryByText("bloque-precio-margen-1")).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Precio y margen" }))
        expect(screen.getByText("bloque-precio-margen-1")).toBeInTheDocument()
    })

    it("hides the Precio y margen tab for a product that is not sold", () => {
        open(2)
        expect(screen.queryByRole("button", { name: "Precio y margen" })).not.toBeInTheDocument()
    })

    it("shows the Fabricación tab for a manufacturing product and mounts its block only when active", () => {
        state.capsById = { 1: { ...fullCaps, manufactures: true, segment: "MANUFACTURABLE_STOCKED" } }
        open(1)
        expect(screen.queryByText("bloque-fabricacion-1")).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Fabricación" }))
        expect(screen.getByText("bloque-fabricacion-1")).toBeInTheDocument()
    })

    it("hides the Fabricación tab for a product that is not manufactured", () => {
        open(1)
        expect(screen.queryByRole("button", { name: "Fabricación" })).not.toBeInTheDocument()
    })

    it("shows the Abastecimiento tab for an input and mounts its block only when active", () => {
        open(2)
        expect(screen.queryByText("bloque-abastecimiento-2")).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Abastecimiento" }))
        expect(screen.getByText("bloque-abastecimiento-2")).toBeInTheDocument()
    })

    it("hides the Abastecimiento tab when the product is neither made+bought nor an input", () => {
        open(1)
        expect(screen.queryByRole("button", { name: "Abastecimiento" })).not.toBeInTheDocument()
    })

    it("shows the Operación tab for a stocked product and mounts its block only when active", () => {
        state.capsById = { 1: { ...fullCaps, tracks_stock: true } }
        open(1)
        expect(screen.queryByText("bloque-operacion-1")).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Operación" }))
        expect(screen.getByText("bloque-operacion-1")).toBeInTheDocument()
    })

    it("hides the Operación tab without stock tracking or recurrence", () => {
        state.capsById = { 1: { ...fullCaps, tracks_stock: false, recurring: false } }
        open(1)
        expect(screen.queryByRole("button", { name: "Operación" })).not.toBeInTheDocument()
    })
})
