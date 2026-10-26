import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { Banknote } from "lucide-react"

import { DocumentRelationsTab, groupByDomain } from "../DocumentRelationsTab"
import type { DocumentLink } from "../../types"

const { getMock, openEntityMock, pushMock } = vi.hoisted(() => ({ getMock: vi.fn(), openEntityMock: vi.fn(), pushMock: vi.fn() }))

vi.mock("@/lib/api", () => ({ default: { get: getMock } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: openEntityMock }),
}))
vi.mock("@/lib/entity-drawers", () => ({ hasEntityDrawer: () => true }))

const link = (label: string, id: number, domain: string, extra: Partial<DocumentLink> = {}) => ({
    semantic: "fulfillment", direction: "outgoing", role: "delivery", amount: null, quantity: null, is_dependency: false,
    target: {
        label, id, display_id: `${label}-${id}`, title: label, icon: null, domain,
        status: "CONFIRMED", status_display: null, date: null, partner_name: null, url: null, accessible: true, exists: true,
    },
    ...extra,
})

const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

/** ADR-0083: tab Relaciones agrupado por área. */
describe("groupByDomain", () => {
    it("orders groups by lifecycle and sums non-cancelled amounts", () => {
        const links = [
            link("treasury.treasurymovement", 1, "treasury", { amount: "100" }),
            link("treasury.treasurymovement", 2, "treasury", { amount: "50" }),
            link("billing.invoice", 3, "billing", { amount: "150" }),
            link("sales.saledelivery", 4, "logistics"),
        ] as DocumentLink[]
        links[1].target.status = "CANCELLED"

        const groups = groupByDomain(links)

        expect(groups.map((g) => g.domain)).toEqual(["billing", "logistics", "treasury"])
        expect(groups.find((g) => g.domain === "treasury")?.total).toBe(100)
        expect(groups.find((g) => g.domain === "logistics")?.total).toBeNull()
    })

    it("keeps an empty area when it has section actions", () => {
        const groups = groupByDomain([], { treasury: [{ id: "pay", label: "Registrar pago", icon: Banknote, onClick: vi.fn() }] })
        expect(groups).toHaveLength(1)
        expect(groups[0]).toMatchObject({ domain: "treasury", links: [] })
    })
})

describe("DocumentRelationsTab", () => {
    beforeEach(() => { getMock.mockReset(); openEntityMock.mockReset(); pushMock.mockReset() })

    it("renders areas, opens a related document and runs the empty-area action", async () => {
        getMock.mockResolvedValue({ data: { document: link("sales.saleorder", 9, "origin").target, relations: [link("sales.saledelivery", 4, "logistics")], unresolved: [] } })
        const pay = vi.fn()

        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} sectionActions={{ treasury: [{ id: "pay", label: "Registrar pago", onClick: pay }] }} />)

        await waitFor(() => expect(screen.getByText("sales.saledelivery-4")).toBeInTheDocument())
        expect(getMock).toHaveBeenCalledWith("/core/documents/sales.saleorder/9/relations/", expect.anything())
        expect(screen.getByText("Sin documentos de tesorería")).toBeInTheDocument()

        fireEvent.click(screen.getByText("sales.saledelivery-4"))
        expect(openEntityMock).toHaveBeenCalledWith("sales.saledelivery", 4, undefined, undefined, { display: "sales.saledelivery-4" })

        fireEvent.click(screen.getByText("Registrar pago"))
        expect(pay).toHaveBeenCalled()
    })

    it("opens a tab even when the target declares a canonical list URL (ADR-0100)", async () => {
        const delivery = link("sales.saledelivery", 4, "logistics")
        delivery.target.url = "/sales/dtes/deliveries?selected=4"
        getMock.mockResolvedValue({ data: { document: link("sales.saleorder", 9, "origin").target, relations: [delivery], unresolved: [] } })

        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} />)

        await waitFor(() => expect(screen.getByText("sales.saledelivery-4")).toBeInTheDocument())
        fireEvent.click(screen.getByText("sales.saledelivery-4"))

        expect(openEntityMock).toHaveBeenCalledWith("sales.saledelivery", 4, undefined, undefined, expect.anything())
        expect(pushMock).not.toHaveBeenCalled()
    })

    it("filters to one area and offers to show all", async () => {
        getMock.mockResolvedValue({ data: { document: link("sales.saleorder", 9, "origin").target, relations: [link("sales.saledelivery", 4, "logistics"), link("billing.invoice", 5, "billing")], unresolved: [] } })
        const onDomainChange = vi.fn()

        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} domain="billing" onDomainChange={onDomainChange} />)

        await waitFor(() => expect(screen.getByText("billing.invoice-5")).toBeInTheDocument())
        expect(screen.queryByText("sales.saledelivery-4")).not.toBeInTheDocument()
        fireEvent.click(screen.getByText("Ver todas las áreas"))
        expect(onDomainChange).toHaveBeenCalledWith(null)
    })

    it("shows the document amount and detail, hiding the sheet's own partner", async () => {
        const order = { ...link("sales.saleorder", 9, "origin").target, partner_name: "Imprenta Norte" }
        const payment = link("treasury.treasurymovement", 7, "treasury", { role: "payment", semantic: "settlement" })
        Object.assign(payment.target, { amount: "3570", detail: "Ingreso · Transferencia", partner_name: "Imprenta Norte" })
        const contact = link("contacts.contact", 3, "contacts", { role: "customer", semantic: "association" })
        Object.assign(contact.target, { detail: "Imprenta Norte · 12345678-9", status: null })
        getMock.mockResolvedValue({ data: { document: order, relations: [payment, contact], unresolved: [] } })

        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} />)

        await waitFor(() => expect(screen.getByText("Ingreso · Transferencia")).toBeInTheDocument())
        expect(screen.getAllByText(/3\.570/).length).toBeGreaterThan(0)
        expect(screen.getByText("Contactos")).toBeInTheDocument()
        expect(screen.getByText("Cliente")).toBeInTheDocument()
        expect(screen.queryByText("Ingreso · Transferencia · Imprenta Norte")).not.toBeInTheDocument()
    })

    it("shows the empty state without relations or actions", async () => {
        getMock.mockResolvedValue({ data: { document: link("sales.saleorder", 9, "origin").target, relations: [], unresolved: [] } })
        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} />)
        await waitFor(() => expect(screen.getByText("Sin documentos relacionados")).toBeInTheDocument())
    })
})
