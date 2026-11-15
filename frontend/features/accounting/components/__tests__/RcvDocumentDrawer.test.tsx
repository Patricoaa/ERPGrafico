import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RcvDocumentDetail } from "../../types"

const m = vi.hoisted(() => ({
    doc: undefined as unknown,
    isError: false,
    openEntity: vi.fn(),
    candidates: [] as unknown[],
    match: vi.fn(),
    unmatch: vi.fn(),
    suggestions: [] as unknown[],
    suggestionsError: false,
    orders: [] as unknown[],
    ordersError: false,
    confirmDraft: vi.fn(),
    createDraft: vi.fn(),
    feedingEnabled: [] as boolean[],
}))

vi.mock("@/features/tax", () => ({
    useRcvDocumentCandidates: () => ({ candidates: m.candidates, isLoading: false, isError: false }),
    useMatchRcvDocument: () => ({ mutateAsync: m.match, isPending: false }),
    useUnmatchRcvDocument: () => ({ mutateAsync: m.unmatch, isPending: false }),
    useRcvDraftSuggestions: (_id: number, enabled: boolean) => {
        m.feedingEnabled.push(enabled)
        return { suggestions: m.suggestions, isLoading: false, isError: m.suggestionsError }
    },
    useRcvSupplierPurchaseOrders: () => ({ orders: m.orders, isLoading: false, isError: m.ordersError }),
    useConfirmRcvDraft: () => ({ mutateAsync: m.confirmDraft, isPending: false }),
    useCreateRcvDraft: () => ({ mutateAsync: m.createDraft, isPending: false }),
}))

vi.mock("../../hooks/useRcvDocuments", () => ({
    useRcvDocument: () => ({ document: m.doc, isLoading: false, isError: m.isError }),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModalActions: () => ({ openEntity: m.openEntity }),
}))
vi.mock("@/features/_shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/_shared")>(),
    useDrawerIdentity: (_label: string, _mode: string, _data: unknown, opts?: { overrideTitle?: string }) => ({
        title: opts?.overrideTitle ?? "Documento", subtitle: "", icon: null,
    }),
}))

import { RcvDocumentDrawer } from "../rcv/RcvDocumentDrawer"

const doc: RcvDocumentDetail = {
    id: 9, direction: "PURCHASES", company_rut: "11111111-1", period: "202610", dte_type: 33, dte_type_label: "Factura Electrónica",
    folio: 4521, counterparty_rut: "76000000-0", counterparty_name: "Proveedor de Prueba", issue_date: "2026-10-05",
    received_at: "2026-10-06T10:00:00-03:00", acknowledged_at: null, operation_type: "", status: "Confirmada",
    acknowledgement: "Recibo otorgado por el receptor", service_indicator: null, exempt_amount: "0", net_amount: "10000",
    vat_amount: "1900", vat_recoverable: "1900", vat_non_recoverable: "0", total_amount: "11900", other_taxes_total: "0",
    reference_dte_type: null, reference_folio: "", is_missing: false,
    match_status: "", match_status_display: "", matched_invoice: null, matched_invoice_display: null, matched_manually: false,
    raw: { folio: 4521 },
    first_import: { id: 3, period: "202610" }, last_import: { id: 5, period: "202611" }, missing_since_import: null,
    created_at: "2026-11-01T10:00:00-03:00", updated_at: "2026-11-01T10:00:00-03:00",
}

beforeEach(() => {
    m.doc = doc
    m.isError = false
    m.openEntity.mockClear()
    m.candidates = []
    m.match.mockReset().mockResolvedValue(undefined)
    m.unmatch.mockReset().mockResolvedValue(undefined)
    m.suggestions = []
    m.suggestionsError = false
    m.orders = []
    m.ordersError = false
    m.confirmDraft.mockReset().mockResolvedValue(undefined)
    m.createDraft.mockReset().mockResolvedValue(undefined)
    m.feedingEnabled = []
})

describe("RcvDocumentDrawer", () => {
    it("muestra identificación, acuse y datos originales plegados", async () => {
        render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("33 · Factura Electrónica")).toBeInTheDocument()
        expect(screen.getByText("Recibo otorgado por el receptor")).toBeInTheDocument()
        expect(screen.queryByText(/"folio": 4521/)).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Mostrar/ }))
        expect(screen.getByText(/"folio": 4521/)).toBeInTheDocument()
    })

    it("no serializa los datos originales mientras están plegados", async () => {
        const stringify = vi.spyOn(JSON, "stringify")
        try {
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(stringify.mock.calls.some(([value]) => value === doc.raw)).toBe(false)
            await userEvent.click(screen.getByRole("button", { name: /Mostrar/ }))
            expect(stringify.mock.calls.some(([value]) => value === doc.raw)).toBe(true)
        } finally {
            stringify.mockRestore()
        }
    })

    it("muestra el período de la ficha con nombre de mes", () => {
        render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("Octubre 2026")).toBeInTheDocument()
    })

    it("enlaza a la importación que trajo el documento", async () => {
        render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
        await userEvent.click(screen.getByRole("button", { name: "Importación Noviembre 2026" }))
        expect(m.openEntity).toHaveBeenCalledWith("accounting.rcvimport", 5)
    })

    it("avisa si el documento no vino en la última importación", () => {
        m.doc = { ...doc, is_missing: true, missing_since_import: { id: 7, period: "202611" } }
        render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("No vino en la última importación")).toBeInTheDocument()
    })

    it("si la carga falla muestra el error", () => {
        m.doc = undefined
        m.isError = true
        render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("No se pudo cargar el documento")).toBeInTheDocument()
    })

    describe("Documento ERP", () => {
        it("sin evaluar muestra «Sin evaluar» y sin candidatos lo indica", () => {
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Documento ERP")).toBeInTheDocument()
            expect(screen.getByText("Sin evaluar")).toBeInTheDocument()
            expect(screen.getByText("Sin documentos candidatos")).toBeInTheDocument()
        })

        it("con vínculo muestra el documento y abre billing.invoice", async () => {
            m.doc = { ...doc, match_status: "MATCHED", match_status_display: "Cuadrado", matched_invoice: 5, matched_invoice_display: "FC-4521" }
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Cuadrado")).toBeInTheDocument()
            await userEvent.click(screen.getByRole("button", { name: "FC-4521" }))
            expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 5)
            expect(screen.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument()
        })

        it("sin vínculo lista candidatos y vincula", async () => {
            m.candidates = [{ id: 7, display_id: "FC-4521", dte_type: "PURCHASE_INV", total: "11900", date: "2026-10-05" }]
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("FC-4521")).toBeInTheDocument()
            await userEvent.click(screen.getByRole("button", { name: "Vincular" }))
            expect(m.match).toHaveBeenCalledWith({ docId: 9, invoiceId: 7 })
        })

        it("con vínculo manual ofrece Desvincular", async () => {
            m.doc = { ...doc, match_status: "MATCHED", match_status_display: "Cuadrado", matched_invoice: 5, matched_invoice_display: "FC-4521", matched_manually: true }
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            await userEvent.click(screen.getByRole("button", { name: "Desvincular" }))
            expect(m.unmatch).toHaveBeenCalledWith(9)
        })
    })

    describe("Registrar en el ERP", () => {
        const missing = { ...doc, match_status: "ONLY_EXTERNAL", match_status_display: "Falta en el ERP" }

        it("solo aparece en compras que faltan en el ERP", () => {
            const { unmount } = render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.queryByText("Registrar en el ERP")).not.toBeInTheDocument()
            unmount()
            m.doc = { ...missing, direction: "SALES" }
            const sales = render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.queryByText("Registrar en el ERP")).not.toBeInTheDocument()
            sales.unmount()
            expect(m.feedingEnabled.every((enabled) => !enabled)).toBe(true)
            m.doc = missing
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Registrar en el ERP")).toBeInTheDocument()
            expect(screen.getByText("Sin borradores parecidos")).toBeInTheDocument()
            expect(screen.getByText("Sin OC del proveedor")).toBeInTheDocument()
        })

        it("asigna folio y emite el borrador sugerido", async () => {
            m.doc = missing
            m.suggestions = [{ id: 31, display_id: "FACC-B31", dte_type: "FACTURA_EXENTA", total: "11800", date: "2026-10-01" }]
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("FACC-B31")).toBeInTheDocument()
            expect(screen.getByText(/^Factura Exenta · Borrador/)).toBeInTheDocument()
            expect(m.confirmDraft).not.toHaveBeenCalled()
            await userEvent.click(screen.getByRole("button", { name: "Asignar folio y emitir" }))
            expect(m.confirmDraft).toHaveBeenCalledWith({ docId: 9, invoiceId: 31 })
        })

        it("crea un borrador desde la OC elegida", async () => {
            m.doc = missing
            m.orders = [
                { id: 40, display_id: "OC-40", date: "2026-10-02", total: "11900" },
                { id: 41, display_id: "OC-41", date: "2026-10-03", total: "5000" },
            ]
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            await userEvent.click(screen.getByRole("button", { name: "Crear borrador desde OC OC-41" }))
            expect(m.createDraft).toHaveBeenCalledWith({ docId: 9, purchaseOrderId: 41 })
            expect(m.createDraft).toHaveBeenCalledTimes(1)
        })

        it("si las consultas fallan muestra el error", () => {
            m.doc = missing
            m.suggestionsError = true
            m.ordersError = true
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("No se pudieron cargar los borradores")).toBeInTheDocument()
            expect(screen.getByText("No se pudieron cargar las OC")).toBeInTheDocument()
        })
    })
})
