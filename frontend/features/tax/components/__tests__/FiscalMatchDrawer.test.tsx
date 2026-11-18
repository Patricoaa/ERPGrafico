import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FiscalMatchDetail, FiscalMatchPart, FiscalMatchSearchItem, FiscalMatchSearchParams } from "../../types/fiscalMatch"

const m = vi.hoisted(() => ({
    group: undefined as unknown,
    isLoading: false,
    isError: false,
    notFound: false,
    refetch: vi.fn(),
    requestedIds: [] as (number | null | undefined)[],
    can: true,
    release: vi.fn(),
    retry: vi.fn(),
    apply: vi.fn(),
    confirmDraft: vi.fn(),
    createDraft: vi.fn(),
    feedingCalls: [] as [number, boolean][],
    openEntity: vi.fn(),
    search: {} as Record<string, unknown[]>,
    searchCalls: [] as [number, string, unknown, boolean][],
    toastError: vi.fn(),
}))

const mutation = (fn: () => unknown) => ({ mutateAsync: fn, isPending: false })

vi.mock("../../hooks/useFiscalMatches", () => ({
    useFiscalMatch: (id: number | null | undefined) => {
        m.requestedIds.push(id)
        return { group: m.group, isLoading: m.isLoading, isError: m.isError, notFound: m.notFound, isRefetching: false, refetch: m.refetch }
    },
    useFiscalMatchSearch: (id: number, part: FiscalMatchPart, params: FiscalMatchSearchParams, enabled: boolean) => {
        m.searchCalls.push([id, part, params, enabled])
        const items = enabled ? (m.search[part] ?? []) : []
        return {
            items, totalCount: items.length, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false,
            isLoading: false, isError: false, refetch: vi.fn(),
        }
    },
    useApplyFiscalMatch: () => mutation(m.apply),
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
vi.mock("sonner", () => ({ toast: { error: m.toastError, info: vi.fn(), success: vi.fn() } }))
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

/** Factura sin su registro RCV. */
const invoiceMissingRcv: FiscalMatchDetail = { ...invoice, rcv_state: "MISSING", rcv_amount: null, rcv_documents: [] }

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

const candidate = (id: number, over: Partial<FiscalMatchSearchItem> = {}): FiscalMatchSearchItem => ({
    id, kind: "rcv", label: `33 N° ${id}`, counterparty: "Cliente Uno", date: "2026-11-10", amount: "80000.00", score: 100, warnings: [], ...over,
})

const renderDrawer = (id: number, props: { onOpenChange?: (open: boolean) => void; onGroupChange?: (id: number) => void } = {}) =>
    render(<FiscalMatchDrawer id={id} open onOpenChange={props.onOpenChange ?? vi.fn()} onGroupChange={props.onGroupChange} />)
const column = (title: string) => screen.getByRole("region", { name: new RegExp(title.replace(/[()]/g, "\\$&")) })
const save = () => screen.getByRole("button", { name: "Guardar cambios" })

beforeEach(() => {
    m.group = voucher
    m.isLoading = false
    m.isError = false
    m.notFound = false
    m.refetch.mockReset()
    m.requestedIds = []
    m.feedingCalls = []
    m.searchCalls = []
    m.search = {}
    m.can = true
    for (const fn of [m.release, m.retry, m.confirmDraft, m.createDraft, m.apply]) fn.mockReset().mockResolvedValue(undefined)
    m.openEntity.mockReset()
    m.toastError.mockReset()
})

describe("FiscalMatchDrawer", () => {
    it("venta: tres columnas numeradas con el estado de cada parte, montos y enlaces", async () => {
        const user = userEvent.setup()
        renderDrawer(1)
        expect(m.requestedIds).toContain(1)
        expect(screen.getAllByRole("region", { name: /^0[123]/ })).toHaveLength(3)

        const erp = column("Documento ERP")
        expect(within(erp).getByText("01")).toBeInTheDocument()
        expect(within(erp).getByText("Cuadrado")).toBeInTheDocument()
        await user.click(within(erp).getByRole("button", { name: "CMP-77" }))
        expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 77)

        const tuu = column("Pagos TUU")
        expect(within(tuu).getByText("02")).toBeInTheDocument()
        expect(within(tuu).getByText(/Pago #501/)).toBeInTheDocument()
        await user.click(within(tuu).getByRole("button", { name: "Venta TUU #5" }))
        expect(m.openEntity).toHaveBeenCalledWith("treasury.terminalsale", 5)

        const rcv = column("RCV (SII)")
        expect(within(rcv).getByText("03")).toBeInTheDocument()
        expect(within(rcv).getByText("Solo resumen")).toBeInTheDocument()
        expect(within(rcv).getByText("El SII solo informa el resumen mensual de los 48")).toBeInTheDocument()
    })

    it("compra: dos columnas (ERP y RCV), sin TUU", () => {
        m.group = { ...invoice, direction: "purchase" }
        renderDrawer(2)
        expect(screen.getAllByRole("region", { name: /^0[123]/ })).toHaveLength(2)
        expect(screen.queryByRole("region", { name: /Pagos TUU/ })).not.toBeInTheDocument()
        expect(within(column("RCV (SII)")).getByText("02")).toBeInTheDocument()
    })

    it("TUU «No aplica» muestra un mensaje en vez de la lista", () => {
        m.group = invoice
        renderDrawer(2)
        expect(within(column("Pagos TUU")).getByText("Este documento no espera pagos TUU")).toBeInTheDocument()
        expect(m.searchCalls.some(([, part, , enabled]) => part === "tuu" && enabled)).toBe(false)
    })

    it("seleccionar un candidato y guardar envía el cuerpo de apply", async () => {
        const user = userEvent.setup()
        m.group = invoiceMissingRcv
        m.search = { rcv: [candidate(33)] }
        m.apply.mockResolvedValue(invoiceMissingRcv)
        renderDrawer(2)
        expect(save()).toBeDisabled()
        await user.click(within(column("RCV (SII)")).getByRole("checkbox", { name: /33 N° 33/ }))
        expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument()
        await user.click(save())
        expect(m.apply).toHaveBeenCalledWith({ id: 2, changes: [{ op: "link", part: "rcv", id: 33 }] })
        await waitFor(() => expect(screen.queryByText("1 cambio sin guardar")).not.toBeInTheDocument())
    })

    it("«Descartar» vacía el borrador", async () => {
        const user = userEvent.setup()
        m.group = invoice
        renderDrawer(2)
        await user.click(within(column("RCV (SII)")).getByRole("button", { name: "Quitar Folio 1532" }))
        expect(screen.getByText("Se quitará")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Descartar" }))
        expect(screen.queryByText("Se quitará")).not.toBeInTheDocument()
    })

    it("el buscador consulta con debounce", async () => {
        const user = userEvent.setup()
        m.group = invoiceMissingRcv
        renderDrawer(2)
        await user.type(within(column("RCV (SII)")).getByRole("searchbox"), "1532")
        await waitFor(() => expect(m.searchCalls.some(([, part, params]) => part === "rcv" && (params as FiscalMatchSearchParams).q === "1532")).toBe(true))
        expect(m.searchCalls.some(([, part, params]) => part === "rcv" && (params as FiscalMatchSearchParams).q === "15")).toBe(false)
    })

    it("una tarjeta con advertencia bloqueante queda deshabilitada con su motivo", () => {
        m.group = { ...invoice, tuu_state: "PENDING" }
        m.search = { tuu: [candidate(81, { kind: "tuu", label: "Venta TUU #81", warnings: [{ code: "TYPE_INCOMPATIBLE", label: "Efectivo solo en boletas", blocking: true }] })] }
        renderDrawer(2)
        const tuu = column("Pagos TUU")
        expect(within(tuu).getByRole("checkbox", { name: /Venta TUU #81/ })).toHaveAttribute("aria-disabled", "true")
        expect(within(tuu).getByText("Efectivo solo en boletas")).toBeInTheDocument()
    })

    it("un 400 marca la tarjeta del cambio y conserva el borrador", async () => {
        const user = userEvent.setup()
        m.group = invoiceMissingRcv
        m.search = { rcv: [candidate(33)] }
        m.apply.mockRejectedValue({ response: { status: 400, data: { error: { message: "Ya hay un registro del SII", code: "SECOND_RCV", details: { change_index: 0 } } } } })
        renderDrawer(2)
        await user.click(within(column("RCV (SII)")).getByRole("checkbox", { name: /33 N° 33/ }))
        await user.click(save())
        expect(await within(column("RCV (SII)")).findByRole("alert")).toHaveTextContent("Ya hay un registro del SII")
        expect(m.toastError).toHaveBeenCalledTimes(1)
        expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument()
    })

    it("un 409 conserva el borrador", async () => {
        const user = userEvent.setup()
        m.group = invoiceMissingRcv
        m.search = { rcv: [candidate(33)] }
        m.apply.mockRejectedValue({ response: { status: 409, data: { error: { message: "El cuadre está en curso", code: "BUSY", details: {} } } } })
        renderDrawer(2)
        await user.click(within(column("RCV (SII)")).getByRole("checkbox", { name: /33 N° 33/ }))
        await user.click(save())
        await waitFor(() => expect(m.apply).toHaveBeenCalled())
        expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument()
        expect(within(column("RCV (SII)")).getByRole("checkbox", { name: /33 N° 33/ })).toHaveAttribute("aria-checked", "true")
    })

    it("cerrar con cambios pide confirmación; sin cambios cierra directo", async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()
        m.group = invoice
        renderDrawer(2, { onOpenChange })
        await user.click(screen.getAllByRole("button", { name: "Cerrar" })[0])
        expect(onOpenChange).toHaveBeenCalledWith(false)
        onOpenChange.mockReset()

        await user.click(within(column("RCV (SII)")).getByRole("button", { name: "Quitar Folio 1532" }))
        await user.click(screen.getAllByRole("button", { name: "Cerrar" })[0])
        expect(onOpenChange).not.toHaveBeenCalled()
        expect(screen.getByText("Hay cambios sin guardar")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Seguir editando" }))
        expect(onOpenChange).not.toHaveBeenCalled()
        expect(screen.getByText("Se quitará")).toBeInTheDocument()

        await user.click(screen.getAllByRole("button", { name: "Cerrar" })[0])
        await user.click(screen.getByRole("button", { name: "Cerrar sin guardar" }))
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    it("solo lectura sin tax.change_taxperiod: sin selección, sin «Quitar» ni pie, pero con enlaces", () => {
        m.can = false
        m.group = invoiceMissingRcv
        m.search = { rcv: [candidate(33)] }
        renderDrawer(2)
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /^Quitar/ })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "FAC-1532" })).toBeInTheDocument()
    })

    it("huérfano: elige el documento ERP, guarda y sigue al grupo resultante", async () => {
        const user = userEvent.setup()
        const onGroupChange = vi.fn()
        m.group = orphan
        m.search = { erp: [candidate(90, { kind: "erp", label: "BOL-90" })] }
        m.apply.mockResolvedValue({ ...voucher, id: 1 })
        renderDrawer(3, { onGroupChange })
        // Sin documento, TUU no ofrece candidatos: solo sus registros propios.
        expect(within(column("Pagos TUU")).getByText(/Primero elige el documento ERP/)).toBeInTheDocument()
        await user.click(within(column("Documento ERP")).getByRole("checkbox", { name: /BOL-90/ }))
        expect(screen.getByText("La venta TUU #6 se moverá también")).toBeInTheDocument()
        await user.click(save())
        expect(m.apply).toHaveBeenCalledWith({ id: 3, changes: [{ op: "link", part: "erp", id: 90, payments: null }] })
        await waitFor(() => expect(onGroupChange).toHaveBeenCalledWith(1))
        expect(m.requestedIds).toContain(1)
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
    })

    it("compra huérfana con un registro RCV: alimentación bajo la columna RCV", async () => {
        const user = userEvent.setup()
        m.group = purchaseOrphan
        renderDrawer(4)
        const rcv = column("RCV (SII)")
        expect(within(rcv).getByRole("heading", { name: "Registrar en el ERP" })).toBeInTheDocument()
        expect(m.feedingCalls).toContainEqual([4, true])
        m.createDraft.mockResolvedValue({ ...purchaseOrphan, id: 4 })
        await user.click(screen.getByRole("button", { name: "Crear borrador desde OC OC-400" }))
        expect(m.createDraft).toHaveBeenCalledWith({ id: 4, purchaseOrderId: 400 })
    })

    it("venta no muestra alimentación de compras", () => {
        m.group = orphan
        renderDrawer(3)
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

    it("un error de carga ofrece reintentar", async () => {
        const user = userEvent.setup()
        m.group = undefined
        m.isError = true
        renderDrawer(1)
        await user.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(m.refetch).toHaveBeenCalled()
    })

    it("un grupo que ya no existe (404) lo explica, sin culpar a la conexión", () => {
        m.group = undefined
        m.isError = true
        m.notFound = true
        renderDrawer(1)
        expect(screen.getByText("Este cuadre ya no existe")).toBeInTheDocument()
        expect(screen.queryByText(/Revisa tu conexión/)).toBeNull()
    })
})
