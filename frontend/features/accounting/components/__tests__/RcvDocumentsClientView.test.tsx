import { fireEvent, render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import type { RcvDocument } from "../../types"

const m = vi.hoisted(() => ({
    docs: [] as unknown[],
    canAdd: true,
    modal: vi.fn(),
    useRcvDocuments: vi.fn(),
    filters: {} as Record<string, string>,
}))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/accounting/rcv/purchases",
}))
vi.mock("@/hooks/useViewMode", () => ({ useViewMode: () => ({ currentView: "list", handleViewChange: vi.fn() }) }))
vi.mock("@/hooks/useEntityPanelRoute", () => ({
    useEntityPanelRoute: () => ({
        selectedId: null,
        open: false,
        close: vi.fn(),
        tab: { id: null, open: false, onClose: vi.fn() },
    }),
}))
vi.mock("@/components/providers", () => ({
    EntityPanelTab: ({ label, open, children }: { label: string; open: boolean; children: (open: boolean) => React.ReactNode }) => (
        <div data-testid={`panel-tab-${label}`}>{children(open)}</div>
    ),
}))
vi.mock("../rcv/RcvDocumentDrawer", () => ({ RcvDocumentDrawer: () => null }))
vi.mock("../rcv/RcvImportModal", () => ({
    RcvImportModal: (props: { open: boolean; defaultDirections?: readonly string[] }) => {
        m.modal(props)
        return props.open ? <div>modal-importar {props.defaultDirections?.join(",")}</div> : null
    },
}))
vi.mock("@/components/auth", () => ({
    Can: ({ permission, children }: { permission: string; children: React.ReactNode }) =>
        permission === "accounting.add_rcvimport" && m.canAdd ? <>{children}</> : null,
}))
vi.mock("@/components/shared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/shared")>()
    return {
        ...actual,
        UnifiedSearchBar: () => null,
        useUnifiedSearch: () => ({
            filters: m.filters,
            isFiltered: Object.keys(m.filters).length > 0,
            applyFilter: vi.fn(),
            clearAll: vi.fn(),
        }),
        bindUnifiedSearch: () => ({}),
    }
})
vi.mock("../../hooks/useRcvDocuments", () => ({
    useRcvDocuments: (filters: unknown) => {
        m.useRcvDocuments(filters)
        return { page: { count: m.docs.length, results: m.docs }, documents: m.docs, totalCount: m.docs.length, isLoading: false, isRefetching: false, isError: false, refetch: vi.fn() }
    },
}))

import { RcvDocumentsClientView } from "../rcv/RcvDocumentsClientView"

const doc: RcvDocument = {
    id: 1, direction: "PURCHASES", company_rut: "11111111-1", period: "2026-10", dte_type: 33, dte_type_label: "Factura Electrónica",
    folio: 4521, counterparty_rut: "76000000-0", counterparty_name: "Proveedor de Prueba", issue_date: "2026-10-05",
    received_at: "2026-10-06T10:00:00-03:00", acknowledged_at: null, operation_type: "", status: "Confirmada",
    acknowledgement: "Recibo otorgado por el receptor", service_indicator: null, exempt_amount: "0", net_amount: "10000",
    vat_amount: "1900", vat_recoverable: "1900", vat_non_recoverable: "0", total_amount: "11900", other_taxes_total: "0",
    reference_dte_type: null, reference_folio: "", is_missing: false,
    fiscal_match: { id: 12, status: "DIFF", status_display: "Con diferencia" },
}

describe("RcvDocumentsClientView", () => {
    beforeEach(() => {
        m.docs = []
        m.canAdd = true
        m.filters = {}
        m.modal.mockClear()
        m.useRcvDocuments.mockClear()
    })

    it("compras muestra la columna de acuse", () => {
        m.docs = [doc]
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(screen.getByRole("columnheader", { name: /Acuse/ })).toBeInTheDocument()
        expect(screen.getByRole("columnheader", { name: /Proveedor/ })).toBeInTheDocument()
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ direction: "PURCHASES", page: 1 }))
    })

    it("ventas no muestra la columna de acuse y usa Cliente", () => {
        m.docs = [{ ...doc, direction: "SALES" }]
        render(<RcvDocumentsClientView direction="SALES" />)
        expect(screen.queryByRole("columnheader", { name: /Acuse/ })).not.toBeInTheDocument()
        expect(screen.getByRole("columnheader", { name: /Cliente/ })).toBeInTheDocument()
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ direction: "SALES" }))
    })

    it("sin filtros y sin filas muestra el estado vacío con 'Sincronizar ahora'", () => {
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(screen.getByText("Aún no hay documentos importados")).toBeInTheDocument()
        expect(screen.getByText("Configura el RCV en Contabilidad → Configuración → RCV / SII o usa «Sincronizar ahora».")).toBeInTheDocument()
        expect(screen.getAllByRole("button", { name: /Sincronizar ahora/ }).length).toBeGreaterThan(0)
    })

    it("'Sincronizar ahora' abre el modal con la dirección de la pestaña preseleccionada", () => {
        m.docs = [{ ...doc, direction: "SALES" }]
        render(<RcvDocumentsClientView direction="SALES" />)
        fireEvent.click(screen.getByRole("button", { name: /Sincronizar ahora/ }))
        expect(screen.getByText("modal-importar SALES")).toBeInTheDocument()
    })

    it("sin permiso oculta 'Sincronizar ahora'", () => {
        m.canAdd = false
        m.docs = [doc]
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(screen.queryByRole("button", { name: /Sincronizar ahora/ })).not.toBeInTheDocument()
    })

    it("traduce los filtros de la URL a filtros de la API", () => {
        m.filters = { year: "2026", month: "10", dte_type: "33", missing: "true", acknowledgement: "No reclamado en plazo" }
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(
            expect.objectContaining({ year: 2026, month: 10, dte_type: 33, missing: "true", acknowledgement: "No reclamado en plazo" }),
        )
    })

    it("traduce estado y rango de fecha de emisión", () => {
        m.filters = { status: "Confirmada", issue_date_from: "2026-10-01", issue_date_to: "2026-10-31" }
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(
            expect.objectContaining({ status: "Confirmada", issue_date_from: "2026-10-01", issue_date_to: "2026-10-31" }),
        )
    })

    it("descarta fechas de emisión mal formadas", () => {
        m.filters = { issue_date_from: "ayer" }
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ issue_date_from: undefined }))
    })

    it("ventas ignora el filtro de acuse", () => {
        m.filters = { acknowledgement: "No reclamado en plazo" }
        render(<RcvDocumentsClientView direction="SALES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ acknowledgement: undefined }))
    })

    it("muestra la columna de cuadre en compras y ventas", () => {
        m.docs = [doc]
        render(<RcvDocumentsClientView direction="PURCHASES" />)
        expect(screen.getByRole("columnheader", { name: /Cuadre/ })).toBeInTheDocument()
        expect(screen.getByText("Con diferencia")).toBeInTheDocument()
    })

    it("filtra por estado de cuadre desde la URL y descarta valores desconocidos", () => {
        m.filters = { fiscal_match_status: "MISSING_ERP" }
        const { unmount } = render(<RcvDocumentsClientView direction="SALES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ fiscal_match_status: "MISSING_ERP" }))
        unmount()
        m.useRcvDocuments.mockClear()
        m.filters = { fiscal_match_status: "ONLY_ERP" }
        render(<RcvDocumentsClientView direction="SALES" />)
        expect(m.useRcvDocuments).toHaveBeenCalledWith(expect.objectContaining({ fiscal_match_status: undefined }))
    })
})
