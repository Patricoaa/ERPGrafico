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
}))

vi.mock("@/features/tax", () => ({
    useRcvDocumentCandidates: () => ({ candidates: m.candidates, isLoading: false, isError: false }),
    useMatchRcvDocument: () => ({ mutateAsync: m.match, isPending: false }),
    useUnmatchRcvDocument: () => ({ mutateAsync: m.unmatch, isPending: false }),
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
    m.match.mockReset()
    m.unmatch.mockReset()
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
})
