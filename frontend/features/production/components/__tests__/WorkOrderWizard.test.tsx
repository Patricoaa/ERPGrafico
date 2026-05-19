import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

vi.mock("@/components/providers/HubPanelProvider", () => ({
    useHubPanel: () => ({
        isHubOpen: false,
        openHubPanel: vi.fn(),
        closeHubPanel: vi.fn()
    })
}))

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

    it("abre en step 0 (BASIC_INFO) en modo create", async () => {
        renderWithProviders(
            <WorkOrderWizard
                mode={{ kind: 'create' }}
                open={true}
                onOpenChange={vi.fn()}
            />
        )
        
        // Wait for Wizard header
        expect(await screen.findByText("Crear Orden de Trabajo")).toBeInTheDocument()
        
        // Only one dialog should be open (no nested BaseModals)
        const dialogs = screen.getAllByRole("dialog")
        expect(dialogs).toHaveLength(1)
        
        // Configuración de Flujo should be visible in create mode Step 0
        expect(screen.getByText(/Configuración de Flujo/i)).toBeInTheDocument()
    })

    it("permite seleccionar origen y avanza a Información Básica", async () => {
        renderWithProviders(
            <WorkOrderWizard
                mode={{ kind: 'create' }}
                open={true}
                onOpenChange={vi.fn()}
            />
        )

        // Wait for title
        expect(await screen.findByText("Crear Orden de Trabajo")).toBeInTheDocument()

        // Initially we are at Step 0: Origen de Fabricación
        expect(screen.getByRole("heading", { name: "Origen de Fabricación" })).toBeInTheDocument()

        // Let's select "Producción para Stock"
        const buttonStock = screen.getByText("Producción para Stock")
        fireEvent.click(buttonStock)

        // It should advance to Step 1: Información Básica
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Información Básica" })).toBeInTheDocument()
        })

        // There should be an "Anterior" button in the footer
        const buttonBack = screen.getByRole("button", { name: "Anterior" })
        expect(buttonBack).toBeInTheDocument()

        // Clicking "Anterior" should return us to Origen de Fabricación
        fireEvent.click(buttonBack)
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Origen de Fabricación" })).toBeInTheDocument()
        })
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
        
        expect(screen.getByText("Gestión de orden de trabajo")).toBeInTheDocument()
    })
})
