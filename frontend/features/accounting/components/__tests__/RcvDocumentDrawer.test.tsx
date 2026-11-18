import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RcvDocumentDetail } from "../../types"

const m = vi.hoisted(() => ({
    doc: undefined as unknown,
    isError: false,
    openEntity: vi.fn(),
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
    fiscal_match: null, matched_manually: false,
    raw: { folio: 4521 },
    first_import: { id: 3, period: "202610" }, last_import: { id: 5, period: "202611" }, missing_since_import: null,
    created_at: "2026-11-01T10:00:00-03:00", updated_at: "2026-11-01T10:00:00-03:00",
}

beforeEach(() => {
    m.doc = doc
    m.isError = false
    m.openEntity.mockClear()
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

    describe("Cuadre", () => {
        it("con grupo muestra su estado y «Ver cuadre» abre tax.fiscalmatch", async () => {
            m.doc = { ...doc, fiscal_match: { id: 21, status: "MISSING_ERP", status_display: "Falta en el ERP" } }
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Falta en el ERP")).toBeInTheDocument()
            await userEvent.click(screen.getByRole("button", { name: "Ver cuadre" }))
            expect(m.openEntity).toHaveBeenCalledWith("tax.fiscalmatch", 21)
        })

        it("sin grupo muestra «Sin evaluar» y no ofrece «Ver cuadre»", () => {
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Sin evaluar")).toBeInTheDocument()
            expect(screen.queryByRole("button", { name: "Ver cuadre" })).not.toBeInTheDocument()
        })

        it("la vinculación y el registro en el ERP viven en la ficha del grupo, no aquí", () => {
            m.doc = { ...doc, fiscal_match: { id: 21, status: "MISSING_ERP", status_display: "Falta en el ERP" } }
            render(<RcvDocumentDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.queryByRole("button", { name: "Vincular" })).not.toBeInTheDocument()
            expect(screen.queryByText("Registrar en el ERP")).not.toBeInTheDocument()
            expect(screen.queryByText("Venta TUU")).not.toBeInTheDocument()
        })
    })
})
