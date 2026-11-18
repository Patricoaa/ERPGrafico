import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { formatTimeOfDay } from "@/components/entity-view"
import type { CandidateMovement, FiscalMatchDetail, FiscalMatchPart } from "../../types/fiscalMatch"

const m = vi.hoisted(() => ({
    group: undefined as unknown,
    isLoading: false,
    isError: false,
    requestedIds: [] as (number | null | undefined)[],
    candidates: { erp: [], tuu: [], rcv: [] } as Record<string, unknown[]>,
    candidateCalls: [] as [number, string, boolean][],
    can: true,
    link: vi.fn(),
    unlink: vi.fn(),
    release: vi.fn(),
    retry: vi.fn(),
    confirmDraft: vi.fn(),
    createDraft: vi.fn(),
    feedingCalls: [] as [number, boolean][],
    openEntity: vi.fn(),
}))

const mutation = (fn: () => unknown) => ({ mutateAsync: fn, isPending: false })

vi.mock("../../hooks/useFiscalMatches", () => ({
    useFiscalMatch: (id: number | null | undefined) => {
        m.requestedIds.push(id)
        return { group: m.group, isLoading: m.isLoading, isError: m.isError, isRefetching: false, refetch: vi.fn() }
    },
    useFiscalMatchCandidates: (id: number, part: FiscalMatchPart, enabled = true) => {
        m.candidateCalls.push([id, part, enabled])
        return { candidates: enabled ? m.candidates[part] : [], isLoading: false, isError: false, isRefetching: false, refetch: vi.fn() }
    },
    useLinkFiscalMatch: () => mutation(m.link),
    useUnlinkFiscalMatch: () => mutation(m.unlink),
    useReleaseFiscalMatch: () => mutation(m.release),
    useRetryFiscalIssue: () => mutation(m.retry),
}))
vi.mock("../../hooks/useFiscalMatchFeeding", () => ({
    useFiscalMatchDraftSuggestions: (groupId: number, enabled: boolean) => {
        m.feedingCalls.push([groupId, enabled])
        return { suggestions: [{ id: 300, display_id: "FC-300", dte_type: "FACTURA", total: "45000", date: "2026-11-02" }], isLoading: false, isError: false }
    },
    useFiscalMatchPurchaseOrders: () => ({
        orders: [{ id: 400, display_id: "OC-400", total: "45000", date: "2026-10-30" }],
        isLoading: false,
        isError: false,
    }),
    useConfirmFiscalMatchDraft: () => mutation(m.confirmDraft),
    useCreateFiscalMatchDraft: () => mutation(m.createDraft),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModalActions: () => ({ openEntity: m.openEntity }),
}))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: () => m.can, hasPermission: () => m.can }) }))
vi.mock("@/features/_shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/_shared")>(),
    useDrawerIdentity: (_label: string, _mode: string, _data: unknown, opts?: { overrideTitle?: string }) => ({
        title: opts?.overrideTitle ?? "Cuadre", subtitle: "", icon: null,
    }),
}))

import { FiscalMatchDrawer } from "../FiscalMatchDrawer"

/** Comprobante 48 cobrado con tarjeta: una venta TUU y RCV solo en el resumen. */
const voucher: FiscalMatchDetail = {
    id: 1,
    direction: "sale",
    status: "MATCHED",
    status_display: "Cuadrado",
    erp_state: "MATCHED",
    tuu_state: "MATCHED",
    rcv_state: "SUMMARY_ONLY",
    dte_type: 48,
    issue_date: "2026-11-10",
    erp_amount: "9990.00",
    tuu_amount: "9990.00",
    rcv_amount: null,
    invoice: { id: 77, display_id: "CMP-77", dte_type: "COMPROBANTE_PAGO", number: "1201", status: "POSTED", total: "9990.00", date: "2026-11-10" },
    terminal_sales: [
        {
            id: 5,
            transaction_at: "2026-11-10T11:40:00-03:00",
            sale_amount: "9990.00",
            document_type: 48,
            payment_type: "DEBIT",
            matched_movement: { id: 501, amount: "9990.00", created_at: "2026-11-10T11:39:00-03:00" },
            linked_manually: false,
        },
    ],
    rcv_documents: [],
    notice: "",
    closed_period_alert: false,
    issue_error: "",
    counterparty_rut: "",
    fiscal_period: "2026-11",
    rcv_linked_manually: false,
    issue_attempted_at: null,
    evaluated_at: "2026-11-10T12:00:00-03:00",
}

/** Factura 33 pagada por transferencia, con su registro RCV. */
const invoice: FiscalMatchDetail = {
    ...voucher,
    id: 2,
    dte_type: 33,
    tuu_state: "NOT_APPLICABLE",
    rcv_state: "MATCHED",
    tuu_amount: null,
    rcv_amount: "80000.00",
    erp_amount: "80000.00",
    invoice: { id: 78, display_id: "FAC-1532", dte_type: "FACTURA", number: "1532", status: "POSTED", total: "80000.00", date: "2026-11-10" },
    terminal_sales: [],
    rcv_documents: [{ id: 9, folio: "1532", dte_type: 33, issue_date: "2026-11-10", total_amount: "80000.00", period: "202611" }],
}

/** Venta TUU sin documento ERP. */
const orphan: FiscalMatchDetail = {
    ...voucher,
    id: 3,
    status: "MISSING_ERP",
    status_display: "Falta en el ERP",
    erp_state: "MISSING",
    rcv_state: "NOT_APPLICABLE",
    dte_type: 39,
    erp_amount: null,
    tuu_amount: "7000.00",
    invoice: null,
    terminal_sales: [{ ...voucher.terminal_sales[0], id: 6, sale_amount: "7000.00", document_type: 39, matched_movement: null }],
}

/** Compra del RCV que falta en el ERP. */
const purchaseOrphan: FiscalMatchDetail = {
    ...orphan,
    id: 4,
    direction: "purchase",
    tuu_state: "NOT_APPLICABLE",
    rcv_state: "MATCHED",
    dte_type: 33,
    tuu_amount: null,
    rcv_amount: "45000.00",
    terminal_sales: [],
    rcv_documents: [{ id: 12, folio: "8801", dte_type: 33, issue_date: "2026-11-02", total_amount: "45000.00", period: "202611" }],
    counterparty_rut: "76123456-7",
}

const pay501: CandidateMovement = { id: 501, amount: "9990.00", created_at: "2026-11-10T11:39:00-03:00", method: "Tarjeta" }
const pay502: CandidateMovement = { id: 502, amount: "9990.00", created_at: "2026-11-10T12:10:00-03:00", method: "Efectivo" }
const time = (m: CandidateMovement) => formatTimeOfDay(m.created_at)

const renderDrawer = (id: number) => render(<FiscalMatchDrawer id={id} open onOpenChange={vi.fn()} />)
const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement

beforeEach(() => {
    m.group = voucher
    m.isLoading = false
    m.isError = false
    m.requestedIds = []
    m.candidates = { erp: [], tuu: [], rcv: [] }
    m.candidateCalls = []
    m.feedingCalls = []
    m.can = true
    for (const fn of [m.link, m.unlink, m.release, m.retry, m.confirmDraft, m.createDraft]) fn.mockReset().mockResolvedValue(undefined)
    m.openEntity.mockReset()
})

describe("FiscalMatchDrawer", () => {
    it("muestra los tres bloques con el estado de cada parte, montos y enlaces", async () => {
        const user = userEvent.setup()
        renderDrawer(1)
        expect(m.requestedIds).toContain(1)

        const erp = section("Documento ERP")
        expect(within(erp).getByText("Cuadrado")).toBeInTheDocument()
        await user.click(within(erp).getByRole("button", { name: "CMP-77" }))
        expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 77)

        const tuu = section("Pagos TUU")
        expect(within(tuu).getByText("Cuadrado")).toBeInTheDocument()
        expect(within(tuu).getByText(/Pago #501/)).toBeInTheDocument()
        await user.click(within(tuu).getByRole("button", { name: /Venta TUU #5/ }))
        expect(m.openEntity).toHaveBeenCalledWith("treasury.terminalsale", 5)

        const rcv = section("RCV (SII)")
        expect(within(rcv).getByText("Solo resumen")).toBeInTheDocument()
        // Solo resumen: el SII no individualiza, no hay nada que vincular.
        expect(within(rcv).queryByRole("button", { name: "Vincular registro RCV" })).not.toBeInTheDocument()
    })

    it("TUU «No aplica» en una factura sin terminal y enlace al registro RCV", async () => {
        const user = userEvent.setup()
        m.group = invoice
        renderDrawer(2)
        expect(within(section("Pagos TUU")).getByText("No aplica")).toBeInTheDocument()
        await user.click(within(section("RCV (SII)")).getByRole("button", { name: "Folio 1532" }))
        expect(m.openEntity).toHaveBeenCalledWith("accounting.rcvdocument", 9)
    })

    it("link TUU sends movement: el usuario elige la venta y el pago", async () => {
        const user = userEvent.setup()
        m.candidates.tuu = [
            { id: 40, transaction_at: "2026-11-10T11:45:00-03:00", sale_amount: "9990.00", document_type: 48, payment_type: "CREDIT", compatible_movements: [pay501, pay502] },
            { id: 41, transaction_at: "2026-11-10T11:50:00-03:00", sale_amount: "9990.00", document_type: 48, payment_type: "CREDIT", compatible_movements: [pay502] },
        ]
        renderDrawer(1)
        // Los candidatos se piden solo al abrir la acción.
        expect(m.candidateCalls.some(([, part, enabled]) => part === "tuu" && enabled)).toBe(false)
        await user.click(screen.getByRole("button", { name: "Agregar pago TUU" }))
        expect(m.candidateCalls).toContainEqual([1, "tuu", true])
        // Varios cobros: un botón por cobro, rotulado con hora local y método.
        const choice = screen.getByRole("button", { name: `Agregar venta TUU #40 al pago ${time(pay502)} · Efectivo` })
        expect(choice).toHaveTextContent(`${time(pay502)} · Efectivo`)
        await user.click(choice)
        expect(m.link).toHaveBeenCalledWith({ id: 1, body: { part: "tuu", id: 40, movement: 502 } })
        // Un solo cobro compatible: un único botón.
        await user.click(screen.getByRole("button", { name: `Agregar venta TUU #41 (pago ${time(pay502)} · Efectivo)` }))
        expect(m.link).toHaveBeenLastCalledWith({ id: 1, body: { part: "tuu", id: 41, movement: 502 } })
    })

    it("oculta «Agregar pago TUU» cuando TUU no aplica", () => {
        m.group = invoice
        renderDrawer(2)
        expect(screen.queryByRole("button", { name: "Agregar pago TUU" })).not.toBeInTheDocument()
    })

    it("ERP con varios cobros del monto de la venta: el usuario elige el pago y se envía movement", async () => {
        const user = userEvent.setup()
        m.group = orphan
        m.candidates.erp = [
            { id: 90, display_id: "BOL-90", dte_type: "BOLETA", number: "90", total: "7000.00", date: "2026-11-10", compatible_movements: [pay501, pay502] },
        ]
        renderDrawer(3)
        await user.click(screen.getByRole("button", { name: "Vincular documento ERP" }))
        await user.click(screen.getByRole("button", { name: `Vincular BOL-90 al pago ${time(pay501)} · Tarjeta` }))
        expect(m.link).toHaveBeenCalledWith({ id: 3, body: { part: "erp", id: 90, movement: 501 } })
    })

    it("tras unir un huérfano, la ficha sigue al grupo del documento", async () => {
        const user = userEvent.setup()
        m.group = orphan
        m.candidates.erp = [{ id: 90, display_id: "BOL-90", dte_type: "BOLETA", number: "90", total: "7000.00", date: "2026-11-10", compatible_movements: [] }]
        m.link.mockResolvedValue({ ...voucher, id: 1 })
        renderDrawer(3)
        await user.click(screen.getByRole("button", { name: "Vincular documento ERP" }))
        m.group = voucher
        await user.click(screen.getByRole("button", { name: "Vincular BOL-90" }))
        expect(m.link).toHaveBeenCalledWith({ id: 3, body: { part: "erp", id: 90 } })
        await waitFor(() => expect(m.requestedIds.at(-1)).toBe(1))
        expect(screen.getByRole("button", { name: "CMP-77" })).toBeInTheDocument()
    })

    it("vincula documento ERP en un huérfano y registro RCV en un grupo con documento", async () => {
        const user = userEvent.setup()
        m.group = orphan
        m.candidates.erp = [{ id: 90, display_id: "BOL-90", dte_type: "BOLETA", number: "90", total: "7000.00", date: "2026-11-10", compatible_movements: [pay501] }]
        const { unmount } = renderDrawer(3)
        expect(screen.queryByRole("button", { name: "Agregar pago TUU" })).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Vincular documento ERP" }))
        await user.click(screen.getByRole("button", { name: `Vincular BOL-90 (pago ${time(pay501)} · Tarjeta)` }))
        expect(m.link).toHaveBeenCalledWith({ id: 3, body: { part: "erp", id: 90, movement: 501 } })
        unmount()

        m.group = { ...invoice, rcv_state: "MISSING", rcv_documents: [] }
        m.candidates.rcv = [{ id: 15, folio: "1532", dte_type: 33, issue_date: "2026-11-10", total_amount: "80000.00", period: "202611", counterparty_rut: "1-9" }]
        renderDrawer(2)
        expect(screen.queryByRole("button", { name: "Vincular documento ERP" })).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Vincular registro RCV" }))
        await user.click(screen.getByRole("button", { name: "Vincular folio 1532" }))
        expect(m.link).toHaveBeenCalledWith({ id: 2, body: { part: "rcv", id: 15 } })
    })

    it("unlink: «Quitar» saca la venta TUU o el registro RCV del grupo", async () => {
        const user = userEvent.setup()
        m.group = { ...invoice, tuu_state: "MATCHED", terminal_sales: voucher.terminal_sales }
        renderDrawer(2)
        await user.click(within(section("Pagos TUU")).getByRole("button", { name: "Quitar" }))
        expect(m.unlink).toHaveBeenCalledWith({ id: 2, body: { part: "tuu", id: 5 } })
        await user.click(within(section("RCV (SII)")).getByRole("button", { name: "Quitar" }))
        expect(m.unlink).toHaveBeenCalledWith({ id: 2, body: { part: "rcv", id: 9 } })
    })

    it("release only on orphan with manual mark", async () => {
        const user = userEvent.setup()
        const release = () => screen.queryByRole("button", { name: "Devolver al cruce automático" })

        m.group = orphan
        const first = renderDrawer(3)
        expect(release()).not.toBeInTheDocument()
        first.unmount()

        m.group = { ...voucher, rcv_linked_manually: true }
        const second = renderDrawer(1)
        expect(release()).not.toBeInTheDocument()
        second.unmount()

        m.group = { ...orphan, terminal_sales: [{ ...orphan.terminal_sales[0], linked_manually: true }] }
        const third = renderDrawer(3)
        await user.click(release() as HTMLElement)
        expect(m.release).toHaveBeenCalledWith({ id: 3 })
        third.unmount()

        m.group = { ...purchaseOrphan, rcv_linked_manually: true }
        renderDrawer(4)
        expect(release()).toBeInTheDocument()
    })

    it("retry issue only with issue_error", async () => {
        const user = userEvent.setup()
        const first = renderDrawer(1)
        expect(screen.queryByRole("button", { name: "Reintentar emisión" })).not.toBeInTheDocument()
        first.unmount()

        m.group = { ...voucher, issue_error: "El SII rechazó el folio" }
        renderDrawer(1)
        expect(screen.getByText("El SII rechazó el folio")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Reintentar emisión" }))
        expect(m.retry).toHaveBeenCalledWith({ id: 1 })
    })

    it("muestra los avisos notice y closed_period_alert", () => {
        m.group = { ...voucher, notice: "Venta TUU rival del mismo monto", closed_period_alert: true }
        renderDrawer(1)
        expect(screen.getByText("Venta TUU rival del mismo monto")).toBeInTheDocument()
        expect(screen.getByText("Cambió en un período cerrado")).toBeInTheDocument()
        expect(screen.getByText(/después de cerrarse su período o de emitirse su documento/)).toBeInTheDocument()
    })

    it("compra huérfana con un registro RCV: alimentación desde el RCV", async () => {
        const user = userEvent.setup()
        m.group = purchaseOrphan
        renderDrawer(4)
        expect(screen.getByRole("heading", { name: "Registrar en el ERP" })).toBeInTheDocument()
        expect(m.feedingCalls).toContainEqual([4, true])
        m.createDraft.mockResolvedValue({ ...purchaseOrphan, id: 4 })
        await user.click(screen.getByRole("button", { name: "Crear borrador desde OC OC-400" }))
        expect(m.createDraft).toHaveBeenCalledWith({ id: 4, purchaseOrderId: 400 })
        await user.click(screen.getByRole("button", { name: "Asignar folio y emitir" }))
        await user.click(screen.getByRole("button", { name: "Emitir" }))
        expect(m.confirmDraft).toHaveBeenCalledWith({ id: 4, invoiceId: 300 })
    })

    it("venta no muestra alimentación de compras", () => {
        m.group = orphan
        renderDrawer(3)
        expect(screen.queryByRole("heading", { name: "Registrar en el ERP" })).not.toBeInTheDocument()
    })

    it("permisos: sin tax.change_taxperiod no hay acciones, pero sí enlaces", () => {
        m.can = false
        m.group = { ...orphan, issue_error: "Falló", terminal_sales: [{ ...orphan.terminal_sales[0], linked_manually: true }] }
        const first = renderDrawer(3)
        for (const name of ["Vincular documento ERP", "Quitar", "Devolver al cruce automático", "Reintentar emisión"]) {
            expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
        }
        expect(screen.getByRole("button", { name: /Venta TUU #6/ })).toBeInTheDocument()
        first.unmount()

        m.group = { ...invoice, rcv_state: "MISSING", rcv_documents: [] }
        const second = renderDrawer(2)
        for (const name of ["Agregar pago TUU", "Vincular registro RCV", "Quitar"]) {
            expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
        }
        second.unmount()

        m.group = purchaseOrphan
        renderDrawer(4)
        expect(screen.queryByRole("heading", { name: "Registrar en el ERP" })).not.toBeInTheDocument()
    })

    it("estados de carga y error", () => {
        m.group = undefined
        m.isLoading = true
        const first = renderDrawer(1)
        expect(screen.getByLabelText("Cargando cuadre")).toBeInTheDocument()
        first.unmount()

        m.isLoading = false
        m.isError = true
        renderDrawer(1)
        expect(screen.getByText("No se pudo cargar el cuadre")).toBeInTheDocument()
    })
})
