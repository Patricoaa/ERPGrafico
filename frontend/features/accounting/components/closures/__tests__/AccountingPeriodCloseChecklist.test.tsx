import { render, screen, act, within } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { AccountingPeriodCloseChecklistModal } from "../AccountingPeriodCloseChecklist"
import type { AccountingPeriodStatus, PendingDocument } from "../../../api/accountingApi"

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

// ── hoisted mocks ──────────────────────────────────────────────────────────
interface WizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    year?: number
    month?: number
    onSuccess: () => void
}

const m = vi.hoisted(() => ({
    status: null as unknown,
    isLoading: false,
    error: null as unknown,
    refetch: vi.fn(),
    openEntity: vi.fn(),
    tabs: [] as Array<{ key: string; active: boolean }>,
    wizardProps: null as unknown,
}))

vi.mock("../../../hooks/useAccountingPeriodStatus", () => ({
    useAccountingPeriodStatus: () => ({
        status: m.status,
        isLoading: m.isLoading,
        isFetching: m.isLoading,
        error: m.error,
        refetch: m.refetch,
    }),
}))

vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: m.openEntity, tabs: m.tabs }),
}))

vi.mock("@/features/tax", async () => ({
    DeclarationWizard: (props: WizardProps) => {
        m.wizardProps = props
        return props.isOpen ? <div data-testid="declaration-wizard" /> : null
    },
}))

// ── helpers ────────────────────────────────────────────────────────────────
/** Radix blocks pointer events on <body> while a dialog is open; call the React onClick directly. */
async function press(el: Element | null) {
    if (!el) throw new Error("press() received a null element")
    const props = Object.entries(el).find(([k]) => k.startsWith("__reactProps"))?.[1] as
        | { onClick?: (e: unknown) => unknown }
        | undefined
    await act(async () => {
        if (props?.onClick) {
            await props.onClick({ preventDefault() {}, stopPropagation() {} })
        } else {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
        }
    })
}

function buttonByText(text: RegExp) {
    return screen.getAllByRole("button").find(b => text.test(b.textContent ?? "")) ?? null
}

function docs(n: number, prefix: string): PendingDocument[] {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        label: `${prefix} ${i + 1}`,
        amount: "1000",
        date: "2026-10-05",
    }))
}

function makeStatus(overrides: Partial<AccountingPeriodStatus> = {}): AccountingPeriodStatus {
    return {
        tax_period_id: 9,
        draft_entries: [],
        draft_invoices: [],
        unposted_payrolls: [],
        unconfirmed_statements: [],
        period_exists: true,
        period_status: "OPEN",
        tax_period_closed: false,
        draft_entries_count: 0,
        draft_invoices_count: 0,
        payroll_count: 1,
        payroll_posted_count: 1,
        reconciliation_count: 1,
        reconciliation_confirmed_count: 1,
        is_fully_closable: false,
        ...overrides,
    }
}

const baseProps = {
    isOpen: true,
    periodId: 3,
    year: 2026,
    month: 10,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isLoading: false,
}

function mount() {
    return render(<AccountingPeriodCloseChecklistModal {...baseProps} />)
}

beforeEach(() => {
    m.status = makeStatus()
    m.isLoading = false
    m.error = null
    m.refetch.mockReset()
    m.openEntity.mockReset()
    m.tabs = []
    m.wizardProps = null
})

describe("AccountingPeriodCloseChecklistModal", () => {
    it("groups the items in Obligatorios and Sugeridos", () => {
        mount()
        const required = screen.getByRole("region", { name: "Obligatorios" })
        const suggested = screen.getByRole("region", { name: "Sugeridos" })

        expect(within(required).getByText("Período tributario (F29) cerrado")).toBeInTheDocument()
        expect(within(required).getByText("Sin asientos en borrador")).toBeInTheDocument()
        expect(within(required).getByText("Sin facturas en borrador")).toBeInTheDocument()
        expect(within(suggested).getByText("Nóminas del mes contabilizadas")).toBeInTheDocument()
        expect(within(suggested).getByText("Conciliaciones bancarias confirmadas")).toBeInTheDocument()
    })

    it("gates the close button on F29 closed, no draft entries and no draft invoices", () => {
        m.status = makeStatus({ tax_period_closed: true })
        const { rerender } = mount()
        expect(buttonByText(/Confirmar Cierre/)).not.toBeDisabled()

        m.status = makeStatus({ tax_period_closed: true, draft_entries_count: 1, draft_entries: docs(1, "Asiento") })
        rerender(<AccountingPeriodCloseChecklistModal {...baseProps} />)
        expect(buttonByText(/Revisar Pendientes/)).toBeDisabled()

        m.status = makeStatus({ tax_period_closed: true, draft_invoices_count: 3, draft_invoices: docs(3, "Factura") })
        rerender(<AccountingPeriodCloseChecklistModal {...baseProps} />)
        expect(buttonByText(/Revisar Pendientes/)).toBeDisabled()
    })

    it("expands an item with pendientes and opens each document with openEntity", async () => {
        m.status = makeStatus({ draft_entries_count: 2, draft_entries: docs(2, "Asiento") })
        mount()
        expect(screen.queryByText("Asiento 1")).not.toBeInTheDocument()

        await press(buttonByText(/Ver 2 pendientes/))
        expect(screen.getByText("Asiento 1")).toBeInTheDocument()

        await press(buttonByText(/Asiento 2/))
        expect(m.openEntity).toHaveBeenCalledWith("accounting.journalentry", 2)
    })

    it.each([
        ["draft_invoices", "draft_invoices_count", "billing.invoice"],
        ["unposted_payrolls", "payroll_count", "hr.payroll"],
        ["unconfirmed_statements", "reconciliation_count", "treasury.bankstatement"],
    ] as const)("opens %s rows with the %s registry label", async (listKey, countKey, label) => {
        m.status = makeStatus({
            [listKey]: docs(1, "Documento"),
            [countKey]: countKey === "draft_invoices_count" ? 1 : 2,
        })
        mount()
        await press(buttonByText(/Ver 1 pendiente/))
        await press(buttonByText(/Documento 1/))
        expect(m.openEntity).toHaveBeenCalledWith(label, 1)
    })

    it("links to the full list when there are more pendientes than listed", async () => {
        m.status = makeStatus({ draft_entries_count: 55, draft_entries: docs(50, "Asiento") })
        mount()
        await press(buttonByText(/Ver 55 pendientes/))

        const more = screen.getByRole("link", { name: /y 5 más/ })
        expect(more).toHaveAttribute("href", "/accounting/entries")
    })

    it("opens the F29 wizard with the tax period id", async () => {
        mount()
        await press(buttonByText(/Abrir F29/))

        expect(screen.getByTestId("declaration-wizard")).toBeInTheDocument()
        const props = m.wizardProps as WizardProps
        expect(props.periodId).toBe(9)
    })

    it("keeps the checklist mounted under the wizard modal (stacked, not hidden)", async () => {
        mount()
        await press(buttonByText(/Abrir F29/))

        expect(screen.getByTestId("declaration-wizard")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: "Obligatorios" })).toBeInTheDocument()
    })

    it("opens the F29 wizard by year/month when there is no tax period", async () => {
        m.status = makeStatus({ tax_period_id: null })
        mount()
        await press(buttonByText(/Abrir F29/))

        const props = m.wizardProps as WizardProps
        expect(props.periodId).toBeUndefined()
        expect(props.year).toBe(2026)
        expect(props.month).toBe(10)
    })

    it("keeps the wizard target when the status refetch changes tax_period_id mid-flow", async () => {
        m.status = makeStatus({ tax_period_id: null })
        const { rerender } = mount()
        await press(buttonByText(/Abrir F29/))
        expect((m.wizardProps as WizardProps).periodId).toBeUndefined()

        m.status = makeStatus({ tax_period_id: 77 })
        rerender(<AccountingPeriodCloseChecklistModal {...baseProps} />)

        const props = m.wizardProps as WizardProps
        expect(props.periodId).toBeUndefined()
        expect(props.year).toBe(2026)
        expect(props.month).toBe(10)
    })

    it("offers a CTA to the list when there are no payrolls or bank statements", () => {
        m.status = makeStatus({ payroll_count: 0, payroll_posted_count: 0, reconciliation_count: 0, reconciliation_confirmed_count: 0 })
        mount()
        const payroll = screen.getByRole("link", { name: "Ir a liquidaciones de sueldo" })
        const statements = screen.getByRole("link", { name: "Ir a conciliaciones" })
        expect(payroll.getAttribute("href")).toBeTruthy()
        expect(statements.getAttribute("href")).toBeTruthy()
    })

    it("refetches the status when the wizard closes", async () => {
        mount()
        await press(buttonByText(/Abrir F29/))
        await act(async () => { (m.wizardProps as WizardProps).onOpenChange(false) })

        expect(m.refetch).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId("declaration-wizard")).not.toBeInTheDocument()
        expect(screen.getByText("Período tributario (F29) cerrado")).toBeInTheDocument()
    })

    it("steps aside while a document tab is active and refetches when it closes", async () => {
        m.status = makeStatus({ draft_entries_count: 1, draft_entries: docs(1, "Asiento") })
        const { rerender } = mount()
        await press(buttonByText(/Ver 1 pendiente/))
        await press(buttonByText(/Asiento 1/))

        m.tabs = [{ key: "accounting.journalentry:1", active: true }]
        rerender(<AccountingPeriodCloseChecklistModal {...baseProps} />)
        expect(screen.queryByText("Sin asientos en borrador")).not.toBeInTheDocument()
        expect(m.refetch).not.toHaveBeenCalled()

        m.tabs = []
        rerender(<AccountingPeriodCloseChecklistModal {...baseProps} />)
        expect(m.refetch).toHaveBeenCalledTimes(1)
        expect(screen.getByText("Sin asientos en borrador")).toBeInTheDocument()
        // the expansion survives the round trip
        expect(screen.getByText("Asiento 1")).toBeInTheDocument()
    })

    it("shows a loading state", () => {
        m.status = null
        m.isLoading = true
        mount()
        expect(screen.getByText(/Verificando estado del período/)).toBeInTheDocument()
        expect(buttonByText(/Revisar Pendientes/)).toBeDisabled()
    })

    it("shows an error state with retry", async () => {
        m.status = null
        m.error = new Error("boom")
        mount()
        expect(screen.getByText("Error al obtener el estado del período")).toBeInTheDocument()
        await press(buttonByText(/Reintentar/))
        expect(m.refetch).toHaveBeenCalledTimes(1)
    })
})
