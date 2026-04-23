import { render, screen, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { WorkOrderForm } from "../index"
import React from "react"

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

describe("WorkOrderForm Unit and Rendering Tests", () => {
    
    it("renders the trigger button when not open by default", () => {
        render(<WorkOrderForm />)
        expect(screen.getByRole("button", { name: /Nueva Orden de Trabajo/i })).toBeInTheDocument()
    })

    it("renders the creation modal completely (Basic Info + Materials) when forced open", () => {
        // The modal content might be lazy-loaded or animated, we use RTL's waitFor if necessary
        render(<WorkOrderForm open={true} onOpenChange={() => {}} />)
        
        // At the beginning, it asks for the type: Linked or Manual
        expect(screen.getByText(/¿Qué tipo de orden desea crear?/i)).toBeInTheDocument()
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

        render(<WorkOrderForm open={true} initialData={mockData} onOpenChange={() => {}} />)
        
        // Should show the title with the Number
        expect(await screen.findByText(/Orden de Trabajo #OT-100/i)).toBeInTheDocument()
        
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
