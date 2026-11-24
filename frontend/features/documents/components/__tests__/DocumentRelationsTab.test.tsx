import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
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
        expect(screen.getByText("Sin documentos de tesorería aún")).toBeInTheDocument()

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
        // "Todas" chip clears the domain filter
        fireEvent.click(screen.getByRole("button", { name: "Todas" }))
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

        await waitFor(() => expect(screen.getByText(/Ingreso · Transferencia/)).toBeInTheDocument())
        expect(screen.getAllByText(/3\.570/).length).toBeGreaterThan(0)
        // "Contactos" aparece en los chips de filtro y en el header de sección
        expect(screen.getAllByText("Contactos").length).toBeGreaterThan(0)
        expect(screen.getByText("Cliente")).toBeInTheDocument()
        expect(screen.queryByText("Ingreso · Transferencia · Imprenta Norte")).not.toBeInTheDocument()
    })

    it("shows the empty state without relations or actions", async () => {
        getMock.mockResolvedValue({ data: { document: link("sales.saleorder", 9, "origin").target, relations: [], unresolved: [] } })
        wrap(<DocumentRelationsTab label="sales.saleorder" id={9} />)
        await waitFor(() => expect(screen.getByText("Sin documentos relacionados")).toBeInTheDocument())
    })
})

describe("DocumentRelationsTab — ventana reciente (ADR-0155)", () => {
    beforeEach(() => { getMock.mockReset(); openEntityMock.mockReset(); pushMock.mockReset() })

    const payload = (hidden: Record<string, number>) => ({
        data: {
            document: link("hr.employee", 5, "hr").target,
            relations: [link("hr.payroll", 1, "hr", { role: "payroll", semantic: "association" })],
            unresolved: [], hidden, window: "recent",
        },
    })

    it("requests window=recent by default", async () => {
        getMock.mockResolvedValue(payload({}))
        wrap(<DocumentRelationsTab label="hr.employee" id={5} />)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        expect(getMock).toHaveBeenCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "recent" } })
    })

    it("shows '+N anteriores' in the area and a 'Ver más (N)' button", async () => {
        getMock.mockResolvedValue(payload({ hr: 4 }))
        wrap(<DocumentRelationsTab label="hr.employee" id={5} />)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        expect(screen.getByText("4 anteriores")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Ver más (4)" })).toBeInTheDocument()
    })

    it("Ver más refetches with window=all and the button goes away", async () => {
        getMock.mockResolvedValueOnce(payload({ hr: 4 }))
        getMock.mockResolvedValueOnce({ data: { ...payload({}).data, window: "all" } })
        wrap(<DocumentRelationsTab label="hr.employee" id={5} />)
        fireEvent.click(await screen.findByRole("button", { name: "Ver más (4)" }))
        await waitFor(() => expect(getMock).toHaveBeenLastCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "all" } }))
        await waitFor(() => expect(screen.queryByRole("button", { name: /Ver más/ })).not.toBeInTheDocument())
    })

    it("shows no button when nothing is hidden", async () => {
        getMock.mockResolvedValue(payload({}))
        wrap(<DocumentRelationsTab label="hr.employee" id={5} />)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        expect(screen.queryByRole("button", { name: /Ver más/ })).not.toBeInTheDocument()
    })

    it("never shows the button when window='all' is forced", async () => {
        getMock.mockResolvedValue(payload({ hr: 4 }))
        wrap(<DocumentRelationsTab label="hr.employee" id={5} window="all" />)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        expect(getMock).toHaveBeenCalledWith("/core/documents/hr.employee/5/relations/", { params: { window: "all" } })
        expect(screen.queryByRole("button", { name: /Ver más/ })).not.toBeInTheDocument()
    })

    it("counts hidden links in the area header", async () => {
        getMock.mockResolvedValue(payload({ hr: 4 }))
        wrap(<DocumentRelationsTab label="hr.employee" id={5} />)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        // 1 propio + 1 visible + 4 ocultos
        expect(within(screen.getByRole("region", { name: "RRHH" })).getByText("6")).toBeInTheDocument()
    })

    it("never submits an enclosing form (chips and Ver más are type=button)", async () => {
        const submit = vi.fn((e: React.FormEvent) => e.preventDefault())
        getMock.mockResolvedValue({
            data: {
                document: link("hr.employee", 5, "hr").target,
                relations: [
                    link("hr.payroll", 1, "hr", { role: "payroll", semantic: "association" }),
                    link("contacts.contact", 3, "contacts", { role: "contact", semantic: "association" }),
                ],
                unresolved: [], hidden: { hr: 4 }, window: "recent",
            },
        })
        wrap(<form onSubmit={submit}><DocumentRelationsTab label="hr.employee" id={5} /></form>)
        await waitFor(() => expect(screen.getByText("hr.payroll-1")).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: "Todas" }))
        fireEvent.click(screen.getAllByRole("button", { name: /RRHH/ })[0])
        fireEvent.click(screen.getByRole("button", { name: "Ver más (4)" }))
        expect(submit).not.toHaveBeenCalled()
    })
})
