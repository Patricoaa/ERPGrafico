import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"

import { RelatedDocumentsTable, type RelatedDocumentItem } from "@/components/shared"

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const item = (role: string, semantic: string, overrides: Partial<RelatedDocumentItem["target"]> = {}): RelatedDocumentItem => ({
    semantic, direction: "outgoing", role, amount: null, quantity: null,
    target: {
        label: "sales.saledelivery", id: 1, display_id: "DES-1", title: "Despacho", status: "CONFIRMED",
        date: "2026-10-02", partner_name: null, accessible: true, ...overrides,
    },
})

/** ADR-0080 (GAP-10): tabla común de documentos relacionados. */
describe("RelatedDocumentsTable", () => {
    it("groups by semantic and opens accessible documents", () => {
        const onOpen = vi.fn()
        const delivery = item("delivery", "fulfillment")
        render(<RelatedDocumentsTable items={[delivery, item("invoice", "derivation", { label: "billing.invoice", id: 5, display_id: "FACV-5" })]} onOpen={onOpen} />)

        expect(screen.getByText("Logística")).toBeInTheDocument()
        expect(screen.getByText("Origen y documentos generados")).toBeInTheDocument()
        screen.getByText("DES-1").click()
        expect(onOpen).toHaveBeenCalledWith(delivery)
    })

    it("shows inaccessible documents without a link", () => {
        render(<RelatedDocumentsTable items={[item("invoice", "derivation", { accessible: false, display_id: "FACV-9", status: null })]} onOpen={vi.fn()} />)
        expect(screen.getByText("FACV-9 · sin acceso")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "FACV-9" })).toBeNull()
    })

    it("handles empty, error and unresolved states", () => {
        const { rerender } = render(<RelatedDocumentsTable items={[]} onOpen={vi.fn()} />)
        expect(screen.getByText("Sin documentos relacionados")).toBeInTheDocument()
        rerender(<RelatedDocumentsTable error={new Error("boom")} onOpen={vi.fn()} />)
        expect(screen.getByText(/No se pudieron cargar/)).toBeInTheDocument()
        rerender(<RelatedDocumentsTable items={[item("delivery", "fulfillment")]} unresolvedCount={2} onOpen={vi.fn()} />)
        expect(screen.getByText(/2 referencia\(s\)/)).toBeInTheDocument()
    })
})
