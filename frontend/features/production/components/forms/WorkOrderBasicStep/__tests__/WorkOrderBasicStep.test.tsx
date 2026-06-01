import { render } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { vi, describe, it, expect } from "vitest"
import { WorkOrderBasicStep } from "../index"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Mock API
vi.mock("@/lib/api", () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { results: [], lines: [] } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
    }
}))

// Mock for Next.js Router
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn()
    }),
}))

// Simple mocked resize observer
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function() {}
window.HTMLElement.prototype.hasPointerCapture = function() { return false }
window.HTMLElement.prototype.releasePointerCapture = function() {}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    )
}

describe("WorkOrderBasicStep Unit and Rendering Tests", () => {
    
    it("renders the type chooser in create mode when defaultOtType is not provided", () => {
        renderWithProviders(<WorkOrderBasicStep mode="create" formId="test-form" />)
        expect(screen.getByText(/Configuración de Flujo/i)).toBeInTheDocument()
    })

    it("renders the LINKED view when initialData has a sale_order", async () => {
        const mockData = {
            id: 1,
            number: "OT-100",
            sale_order: 55,
            sale_order_number: "500",
            sale_line: { id: 123, product: { name: "Test Product" } },
            status: "DRAFT",
            current_stage: "PREPRESS",
            production_progress: 10,
            stage_data: {
                phases: { prepress: true, press: false, postpress: false }
            }
        }

        renderWithProviders(<WorkOrderBasicStep mode="edit" initialData={mockData} formId="test-form" />)
        
        // Should show the "Vínculo de Venta" header
        expect(await screen.findByText("Vínculo de Venta")).toBeInTheDocument()
        
        // Wait for specific subcomponents texts
        expect(await screen.findByText("NV-500")).toBeInTheDocument()
        expect(screen.getByText("Detalle de Producto en Venta")).toBeInTheDocument()
        expect(screen.getByText("Progreso OT")).toBeInTheDocument()
        
        // Should show Materials Subcomponent titles
        expect(screen.getAllByText("Pre-Impresión").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Impresión").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Post-Impresión").length).toBeGreaterThan(0)
        
        // The Prepress switch was enabled, verify its sections are visible
        expect(screen.getByText("Diseño Requerido")).toBeInTheDocument()
    })
})
