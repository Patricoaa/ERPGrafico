import { render, screen, waitFor } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { WorkOrderForm } from "../index"
import React from "react"

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

    it("renders the LINKED view when initialData has a sale_order", () => {
        const mockData = {
            id: 1,
            number: "OT-100",
            sale_order: 55,
            sale_order_number: "NV-500",
            status: "DRAFT",
            current_stage: "PREPRESS",
            production_progress: 10,
            stage_data: {
                phases: { prepress: true, press: false, postpress: false }
            }
        }

        render(<WorkOrderForm open={true} initialData={mockData} onOpenChange={() => {}} />)
        
        // Should show the title with the Number
        expect(screen.getByText(/Orden de Trabajo #OT-100/i)).toBeInTheDocument()
        
        // Should show the "Vínculo de Venta" header
        expect(screen.getByText("Vínculo de Venta")).toBeInTheDocument()
        
        // Wait for specific subcomponents texts
        expect(screen.getByText("NV-500")).toBeInTheDocument()
        expect(screen.getByText("Detalle de Producto en Venta")).toBeInTheDocument()
        expect(screen.getByText("Progreso OT")).toBeInTheDocument()
        
        // Should show Materials Subcomponent titles
        expect(screen.getByText("Pre-Impresión")).toBeInTheDocument()
        expect(screen.getByText("Impresión")).toBeInTheDocument()
        expect(screen.getByText("Post-Impresión")).toBeInTheDocument()
        
        // The Prepress switch was enabled, verify its sections are visible
        expect(screen.getByText("Diseño Requerido")).toBeInTheDocument()
    })
})
