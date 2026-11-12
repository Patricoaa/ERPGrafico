import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Partner } from "@/features/contacts"
import { PartnerDrawer } from "../PartnerDrawer"
import { demoteBlockedReason } from "../partnerActions"

const m = vi.hoisted(() => ({
    partners: [] as unknown[],
    run: vi.fn(),
    overview: undefined as unknown,
    overviewCalls: [] as (number | null)[],
}))

vi.mock("@/features/contacts", () => ({
    usePartners: () => ({ partners: m.partners, isLoading: false }),
    netEquityPercentages: () => ({}),
}))
vi.mock("@/features/comments", () => ({ EntitySidebar: () => null }))
vi.mock("@/features/documents", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/documents")>(),
    DocumentRelationsTab: ({ label, id }: { label: string; id: number }) => <div>relations-tab {label} #{id}</div>,
}))
vi.mock("@/features/_shared", () => ({
    useDrawerIdentity: () => ({ title: "Socio", subtitle: "", icon: null }),
}))
vi.mock("../../hooks", () => ({
    useProfitDistributions: () => ({ distributions: [], isLoading: false, error: null, refetch: vi.fn() }),
    usePartnerOverview: (id: number | null) => (m.overviewCalls.push(id), { data: m.overview, isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock("../PartnerActionModal", () => ({
    usePartnerActions: () => ({ run: m.run, host: null }),
}))
vi.mock("../PartnerLedgerPanel", () => ({ PartnerLedgerPanel: () => <div>ledger-panel</div> }))
vi.mock("../PartnerCapitalPanel", () => ({ PartnerCapitalPanel: () => <div>capital-panel</div> }))
vi.mock("../PartnerResultsPanel", () => ({ PartnerResultsPanel: () => <div>results-panel</div> }))
vi.mock("../PartnerSummaryPanel", () => ({
    PartnerSummaryPanel: ({ onGoToTab }: { onGoToTab: (t: "capital" | "results") => void }): ReactNode => (
        <button onClick={() => onGoToTab("capital")}>Ver capital</button>
    ),
}))

const partner: Partner = {
    id: 7, name: "Ana Socia", tax_id: "1-9", partner_equity_percentage: "50",
    partner_total_contributions: "0", partner_total_paid_in: "0", partner_pending_capital: "0",
    partner_excess_capital: "0", partner_provisional_withdrawals_balance: "0",
    partner_earnings_balance: "0", partner_dividends_payable_balance: "0", partner_net_equity: "0",
}

const renderDrawer = (id = 7) => render(<PartnerDrawer id={id} open onOpenChange={vi.fn()} />)

beforeEach(() => {
    m.run.mockClear()
    m.partners = [partner]
    m.overview = undefined
    m.overviewCalls = []
})

describe("PartnerDrawer", () => {
    it("muestra las 6 pestañas en orden", () => {
        renderDrawer()
        const names = screen.getAllByRole("tab").map(t => t.textContent)
        expect(names).toEqual(["Resumen", "Capital", "Resultados y retiros", "Distribuciones", "Libro", "Relaciones"])
    })

    it("Relaciones muestra los relacionados del socio (contacts.partner)", async () => {
        renderDrawer()
        await userEvent.click(screen.getByRole("tab", { name: "Relaciones" }))
        expect(await screen.findByText("relations-tab contacts.partner #7")).toBeInTheDocument()
    })

    it("el Resumen cambia de pestaña con onGoToTab", async () => {
        renderDrawer()
        await userEvent.click(screen.getByRole("button", { name: "Ver capital" }))
        expect(await screen.findByText("capital-panel")).toBeInTheDocument()
    })

    it("el header solo ofrece Dar de baja y lo ejecuta si no hay bloqueo", async () => {
        renderDrawer()
        await userEvent.click(screen.getByRole("button", { name: "Acciones" }))
        const items = screen.getAllByRole("menuitem")
        expect(items).toHaveLength(1)
        await userEvent.click(items[0])
        expect(m.run).toHaveBeenCalledWith({ type: "demote", partnerId: 7 })
    })

    it("con saldos pendientes la baja está deshabilitada y muestra el motivo", async () => {
        const blocked = { ...partner, partner_total_contributions: "100" }
        m.partners = [blocked]
        renderDrawer()
        await userEvent.click(screen.getByRole("button", { name: "Acciones" }))
        const item = screen.getByRole("menuitem")
        expect(item).toHaveAttribute("aria-disabled", "true")
        expect(item).toHaveTextContent(demoteBlockedReason(blocked) ?? "")
        await userEvent.click(item)
        expect(m.run).not.toHaveBeenCalled()
    })

    it("subtítulo: ID fiscal y fecha de alta; solo ID fiscal mientras carga o sin fecha", () => {
        m.overview = { info: { tax_id: "1-9", partner_since: "2025-01-02", contact_id: 7 } }
        const { unmount } = renderDrawer()
        expect(screen.getByText(/^1-9 · socio desde .*2025/)).toBeInTheDocument()
        unmount()
        m.overview = { info: { tax_id: "1-9", partner_since: null, contact_id: 7 } }
        renderDrawer()
        expect(screen.getByText("1-9")).toBeInTheDocument()
    })

    it("un id que no es socio muestra el aviso", () => {
        renderDrawer(99)
        expect(screen.getByText("Este contacto no es un socio de la sociedad.")).toBeInTheDocument()
        expect(m.overviewCalls.every(c => c === null)).toBe(true)
    })
})
