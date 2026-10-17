import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import React from "react"

import { LazyDrawer, docTypeToLabel } from "../drawerRegistry"

vi.mock("@/lib/entity-drawers", () => {
    const stub = (label: string) => function DrawerStub({ id, open }: { id: number; open: boolean }) {
        return <span>{`${label}:${id}:${open ? "open" : "closed"}`}</span>
    }
    return {
        ENTITY_DRAWERS: {
            "accounting.journalentry": stub("accounting.journalentry"),
            "inventory.stockmove": stub("inventory.stockmove"),
            "purchasing.purchaseorder": stub("purchasing.purchaseorder"),
        },
    }
})

/** ADR-0080 (GAP-12): LazyDrawer renderiza las fichas de ENTITY_DRAWERS (DRAWER_MAP retirado). */
describe("LazyDrawer", () => {
    it("maps legacy docTypes to registered labels", () => {
        expect(docTypeToLabel("inventory")).toBe("inventory.stockmove")
        expect(docTypeToLabel("service_obligation")).toBe("purchasing.purchaseorder")
        expect(docTypeToLabel("inventory_document")).toBe("inventory.inventorydocument")
        expect(docTypeToLabel("nope")).toBeUndefined()
    })

    it("renders the registered drawer with the given id", () => {
        render(<LazyDrawer type="journal_entry" id="42" open onOpenChange={vi.fn()} />)
        expect(screen.getByText("accounting.journalentry:42:open")).toBeInTheDocument()
    })

    it("renders nothing for unknown types or missing id", () => {
        const { container } = render(<LazyDrawer type="nope" id={1} open />)
        expect(container).toBeEmptyDOMElement()
        const { container: noId } = render(<LazyDrawer type="journal_entry" id={null} open />)
        expect(noId).toBeEmptyDOMElement()
    })
})
