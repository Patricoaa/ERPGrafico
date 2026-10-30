import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PurchaseCheckoutWizard } from "../PurchaseCheckoutWizard"
import { type PurchaseOrderAPI } from "../../types"

// Polyfills
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

// Mock API
vi.mock("@/lib/api", () => ({
    default: {
        get: vi.fn().mockImplementation((url: string) => {
            if (url.includes("/purchasing/orders/")) {
                return Promise.resolve({
                    data: {
                        id: 10,
                        number: "OC-00010",
                        supplier: 1,
                        supplier_name: "Proveedor Test",
                        total: "1000",
                        lines: [],
                        status: "PENDING",
                    }
                })
            }
            return Promise.resolve({ data: { results: [] } })
        }),
        post: vi.fn().mockResolvedValue({ data: { id: 10 } }),
        put: vi.fn().mockResolvedValue({ data: {} }),
    }
}))

vi.mock("@/hooks/useVatRate", () => ({
    useVatRate: () => ({ rate: 0.19, multiplier: 1.19 }),
}))

vi.mock("@/hooks/useTreasuryAccounts", () => ({
    useTreasuryAccounts: () => ({ accounts: [] }),
}))

vi.mock("@/hooks/useServerDate", () => ({
    useServerDate: () => ({ dateString: "2026-10-30" }),
}))

vi.mock("@/features/documents", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/features/documents")>()
    return {
        ...actual,
        DocumentRelationsTab: ({ id }: { id: number }) => <div data-testid="relations-tab">Relaciones del pedido #{id}</div>,
        useDocumentRelations: (_label: string, id: number | null) => ({
            data: id ? { relations: [{ id: 101, type: "invoice" }] } : null,
        }),
    }
})

vi.mock("../checkout/Step0_Supplier", () => ({
    Step0_Supplier: ({ selectedSupplierId, setSelectedSupplierId, setSelectedSupplierName }: {
        selectedSupplierId: string | null
        setSelectedSupplierId: (id: string) => void
        setSelectedSupplierName: (name: string) => void
    }) => (
        <div data-testid="step-0-supplier">
            <span>Proveedor Step Content</span>
            <button
                type="button"
                onClick={() => {
                    setSelectedSupplierId("1")
                    setSelectedSupplierName("Papeles del Sur")
                }}
            >
                Seleccionar Proveedor
            </button>
            <span data-testid="selected-supplier">{selectedSupplierId ?? "none"}</span>
        </div>
    ),
}))

vi.mock("../checkout/Step1_ProductSelection", () => ({
    Step1_ProductSelection: () => <div data-testid="step-1-products">Productos Step Content</div>,
}))

vi.mock("../checkout/Step2_PurchaseDTE", () => ({
    Step2_PurchaseDTE: () => <div data-testid="step-2-dte">DTE Step Content</div>,
}))

vi.mock("../checkout/Step3_PurchasePayment", () => ({
    Step3_PurchasePayment: () => <div data-testid="step-3-payment">Payment Step Content</div>,
}))

vi.mock("../checkout/Step4_Receipt", () => ({
    Step4_Receipt: () => <div data-testid="step-4-receipt">Receipt Step Content</div>,
}))

/** Create a fresh client per-test to avoid cross-test cache leakage. */
const makeQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderWithProviders = (ui: React.ReactElement) => {
    const client = makeQueryClient()
    return render(
        <QueryClientProvider client={client}>
            {ui}
        </QueryClientProvider>
    )
}

describe("PurchaseCheckoutWizard with DrawerLayout and Tab system", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        // Ensure any mounted component is unmounted between tests, preventing
        // DOM leakage when a previous test fails mid-async-operation.
        cleanup()
    })

    it("renders as an embedded bottom Drawer utilizing DrawerLayout with top tabs and rails", async () => {
        renderWithProviders(
            <PurchaseCheckoutWizard
                open={true}
                onOpenChange={vi.fn()}
                order={null}
                orderLines={[{ product: "1", product_name: "Papel Couché", quantity: 1, uom: "1", uom_name: "resma", unit_cost: 1000, tax_rate: 0.19 }]}
                total={1190}
                onComplete={vi.fn()}
            />
        )

        // Drawer header
        expect(screen.getByText("Nueva Orden de Compra")).toBeInTheDocument()
        // "01 / 05" and "Proveedor" appear in both the drawer subtitle and the WizardStepsSidebar
        expect(screen.getAllByText("01 / 05").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("Proveedor").length).toBeGreaterThanOrEqual(1)

        // Tab bar trigger from DrawerLayout
        expect(screen.getByRole("tab", { name: /compra/i })).toBeInTheDocument()

        // Left rail (Process Summary)
        expect(screen.getByText("Proceso de Compra")).toBeInTheDocument()

        // Right rail (Order Summary)
        expect(screen.getByText("Detalle de Productos")).toBeInTheDocument()
        expect(screen.getByText("Total Compra")).toBeInTheDocument()

        // Content
        expect(screen.getByTestId("step-0-supplier")).toBeInTheDocument()

        // Footer buttons
        expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /siguiente/i })).toBeInTheDocument()
    })

    it("includes 'Relaciones' tab when an order ID is present and switches tabs", async () => {
        const user = userEvent.setup()
        renderWithProviders(
            <PurchaseCheckoutWizard
                open={true}
                onOpenChange={vi.fn()}
                order={{
                    id: 10,
                    number: "OC-00010",
                    status: "DRAFT",
                    total: 1000,
                    supplier: 1,
                    lines: [],
                } as unknown as PurchaseOrderAPI}
                orderLines={[]}
                total={1000}
                onComplete={vi.fn()}
            />
        )

        // Top tabs: Both Compra and Relaciones should be present
        const compraTab = screen.getByRole("tab", { name: /compra/i })
        const relationsTab = screen.getByRole("tab", { name: /relaciones/i })
        expect(compraTab).toBeInTheDocument()
        expect(relationsTab).toBeInTheDocument()

        // Switch to Relaciones tab — userEvent fires the full pointer-event chain
        // that Radix UI Tabs requires (fireEvent.click alone is insufficient in jsdom)
        await user.click(relationsTab)

        expect(await screen.findByTestId("relations-tab")).toBeInTheDocument()
        expect(screen.getByText("Relaciones del pedido #10")).toBeInTheDocument()

        // In non-checkout tab, footer shows "Cerrar". The drawer's X close button also
        // matches /cerrar/i, so use getAllByRole and assert at least one.
        expect(screen.getAllByRole("button", { name: /cerrar/i }).length).toBeGreaterThanOrEqual(1)
    })

    it("validates step 1 before allowing advance to step 2", async () => {
        renderWithProviders(
            <PurchaseCheckoutWizard
                open={true}
                onOpenChange={vi.fn()}
                order={null}
                orderLines={[]}
                total={0}
                onComplete={vi.fn()}
            />
        )

        const nextButton = screen.getByRole("button", { name: /siguiente/i })
        fireEvent.click(nextButton)

        // Should stay in step 1 because no supplier was selected
        expect(screen.getByTestId("step-0-supplier")).toBeInTheDocument()
        expect(screen.queryByTestId("step-1-products")).not.toBeInTheDocument()

        // Select supplier
        const selectBtn = screen.getByRole("button", { name: /seleccionar proveedor/i })
        fireEvent.click(selectBtn)

        expect(screen.getByTestId("selected-supplier")).toHaveTextContent("1")

        // Now advance
        fireEvent.click(nextButton)

        // Advances to step 2
        await waitFor(() => {
            expect(screen.getByTestId("step-1-products")).toBeInTheDocument()
        })
    })

    it("allows collapsing the left rail via onToggleCollapsed", async () => {
        renderWithProviders(
            <PurchaseCheckoutWizard
                open={true}
                onOpenChange={vi.fn()}
                order={null}
                orderLines={[]}
                total={0}
                onComplete={vi.fn()}
            />
        )

        // Find the collapse button on WizardStepsSidebar
        const collapseBtn = screen.getByRole("button", { name: /colapsar etapas/i })
        expect(collapseBtn).toBeInTheDocument()

        fireEvent.click(collapseBtn)

        // Should now show expand button
        expect(screen.getByRole("button", { name: /expandir etapas/i })).toBeInTheDocument()
    })
})
