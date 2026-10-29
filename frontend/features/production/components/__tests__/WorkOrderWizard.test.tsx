import { render, fireEvent, waitFor } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { WorkOrderWizard } from "../WorkOrderWizard"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Mock API
vi.mock("@/lib/api", () => ({
    default: {
        get: vi.fn().mockImplementation((url) => {
            if (url.includes("/production/orders/")) {
                return Promise.resolve({
                    data: {
                        id: 123,
                        number: "OT-123",
                        status: "DRAFT",
                        current_stage: "PREPRESS",
                        stage_data: {}
                    }
                })
            }
            return Promise.resolve({ data: { results: [], lines: [] } })
        }),
        post: vi.fn().mockResolvedValue({ data: { id: 123 } }),
        put: vi.fn().mockResolvedValue({ data: {} }),
    }
}))

// Mock Next.js Router
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn()
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/production/orders",
}))

vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 1, name: "Test User" },
        token: "test-token"
    })
}))

// ADR-0083: el asistente abre la ficha de la orden con openEntity (ya no el Order Hub)
vi.mock("@/components/providers/GlobalModalProvider", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/providers/GlobalModalProvider")>()
    const modals = {
        openEntity: vi.fn(), closeEntity: vi.fn(), goBackEntity: vi.fn(), setEntityDisplay: vi.fn(),
        registerSheet: vi.fn(), unregisterSheet: vi.fn(), isSubModalActive: false,
        getSheetOffset: () => 0, getSheetIndex: () => 0, isSheetCollapsed: () => false,
        expandedSheetWidth: 0, totalSheetsWidth: 0,
    }
    return { ...actual, useGlobalModals: () => modals, useGlobalModalActions: () => modals }
})

// Polyfills required by the Drawer / ProductSelector tree (jsdom lacks these).
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
})

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    )
}

describe("WorkOrderWizard Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("abre en step 0 (ORIGIN_SELECTION) en modo create", async () => {
        renderWithProviders(
            <WorkOrderWizard
                mode={{ kind: 'create' }}
                open={true}
                onOpenChange={vi.fn()}
            />
        )

        // Wait for Wizard header
        expect(await screen.findByText("Nueva Orden de Trabajo")).toBeInTheDocument()

        // Only one dialog should be open (no nested BaseModals)
        const dialogs = screen.getAllByRole("dialog")
        expect(dialogs).toHaveLength(1)

        // Step 0 create = OriginSelectionStep (type chooser).
        expect(screen.getByText("Vincular a Venta")).toBeInTheDocument()
        expect(screen.getByText("Producción para Stock")).toBeInTheDocument()
    })

    it("permite seleccionar origen y avanza a Selección de Producto", async () => {
        renderWithProviders(
            <WorkOrderWizard
                mode={{ kind: 'create' }}
                open={true}
                onOpenChange={vi.fn()}
            />
        )

        // Wait for title
        expect(await screen.findByText("Nueva Orden de Trabajo")).toBeInTheDocument()

        // Step 0: Origen de Fabricación (type chooser).
        const buttonStock = screen.getByText("Producción para Stock")
        fireEvent.click(buttonStock)

        // Advances to step 1: PRODUCT_SELECTION — footer offers "Seleccionar Producto".
        await waitFor(() => {
            expect(screen.getByText("Seleccionar Producto")).toBeInTheDocument()
        })

        // The origin chooser is no longer rendered.
        expect(screen.queryByText("Vincular a Venta")).not.toBeInTheDocument()
    })

    it("modo manage en targetStage", async () => {
        renderWithProviders(
            <WorkOrderWizard
                mode={{ kind: 'manage', orderId: 123, targetStage: 'PREPRESS' }}
                open={true}
                onOpenChange={vi.fn()}
            />
        )
        
        // Wait for data load
        await waitFor(() => {
            expect(screen.queryByText("Cargando detalles de OT...")).not.toBeInTheDocument()
        })
        
        // Only one dialog should be open
        const dialogs = screen.getAllByRole("dialog")
        expect(dialogs).toHaveLength(1)
        
        // The stage lives in the rail; the header no longer repeats it.
        expect(screen.getByText("Orden de Trabajo · Manual")).toBeInTheDocument()
        expect(screen.getAllByText("Pre-Impresión").length).toBeGreaterThan(0)
    })
})
