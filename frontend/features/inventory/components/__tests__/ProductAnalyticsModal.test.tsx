import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"

vi.mock("../../hooks/useProducts", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../hooks/useProducts")>()),
    useProductInsights: () => ({
        isLoading: false,
        insights: {
            price_history: [], kardex: [], stock_history: [], production_usage: [], production_history: [],
            top_customers: [], top_suppliers: [],
            sales_analysis: { history: [], total_sold: 0, total_revenue: 0, total_cost_basis: 0 },
            purchase_analysis: { history: [], total_purchased: 0, total_cost: 0 },
        },
    }),
    useProduct: () => ({
        isLoading: false,
        product: { id: 1, uom_name: "un", current_stock: 0, cost_price: 0, sale_price: 0, sale_price_gross: 0 },
    }),
}))
vi.mock("@/features/inventory/hooks/useStockMoves", () => ({ useStockMoves: () => ({ data: [], isLoading: false }) }))
vi.mock("@/components/selectors", () => ({ ProductSelector: () => <div>selector-producto</div> }))
vi.mock("@/features/_shared", () => ({ LazyDrawer: () => null }))
vi.mock("@/features/production", () => ({ WorkOrderWizard: () => null }))

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
        expect(screen.getByText("selector-producto")).toBeInTheDocument()
        expect(screen.getByRole("navigation", { name: "Secciones de análisis de producto" })).toBeInTheDocument()
    })

    it("shows the product name in the rail when onProductChange is absent", () => {
        render(<ProductAnalyticsModal productId={1} productName="Tarjeta Doble Faz" open onOpenChange={() => {}} />)
        expect(screen.getByText("Tarjeta Doble Faz")).toBeInTheDocument()
        expect(screen.queryByText("selector-producto")).not.toBeInTheDocument()
    })
})
