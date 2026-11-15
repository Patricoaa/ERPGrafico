import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TerminalSaleDetail } from "../../types"

const m = vi.hoisted(() => ({
    sale: undefined as unknown,
    isError: false,
    requestedIds: [] as (number | null)[],
    candidates: [] as unknown[],
    match: vi.fn(),
    unmatch: vi.fn(),
    openEntity: vi.fn(),
}))

vi.mock("../../hooks/useTerminalSaleMatch", () => ({
    useTerminalSaleCandidates: () => ({ candidates: m.candidates, isLoading: false, isError: false }),
    useMatchTerminalSale: () => ({ mutateAsync: m.match, isPending: false }),
    useUnmatchTerminalSale: () => ({ mutateAsync: m.unmatch, isPending: false }),
}))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: m.openEntity }),
}))

vi.mock("../../hooks/useTerminalSales", () => ({
    useTerminalSale: (id: number | null) => {
        m.requestedIds.push(id)
        return { sale: m.sale, isLoading: false, isError: m.isError }
    },
}))
vi.mock("@/features/documents", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/documents")>(),
    DocumentRelationsTab: ({ label, id }: { label: string; id: number }) => <div>relations-tab {label} #{id}</div>,
}))
vi.mock("@/features/_shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/features/_shared")>(),
    useDrawerIdentity: (_label: string, _mode: string, _data: unknown, opts?: { overrideTitle?: string }) => ({
        title: opts?.overrideTitle ?? "Venta", subtitle: "", icon: null,
    }),
}))

import { TerminalSaleDrawer } from "../TerminalSaleDrawer"

const sale: TerminalSaleDetail = {
    id: 9, provider: 1, provider_name: "TUU Local", device: null, device_name: null, serial_number: "SN1",
    sale_id: "13347", sequence_number: "", location_id: "", transaction_at: "2026-11-12T10:00:00-03:00",
    status: "COMPLETED", raw_status: "Completed", payment_type: "CASH", document_type: 39, document_type_label: "Boleta Electrónica", dte_type: "BOLETA",
    instance: null, card_brand: "", card_issuer: "", installment_count: null, currency: "CLP",
    sale_amount: "3200", tip_amount: "0", cashback_amount: "0", total_amount: "3200",
    commission_amount: null, net_amount: null, settlement_date: null, settlement_id: null, settlement_amount: null,
    natural_key: "cash:13347", card_bin: "", card_origin: "", installment_type: "", acquirer_id: null,
    sources: ["BRANCH"], items: [], reconciliations: [], raw: { branch: { saleId: "13347" } },
    match_status: "", match_status_display: "", matched_invoice: null, matched_invoice_display: null, matched_manually: false,
    first_seen_run: 1, last_seen_run: 1, created_at: "2026-11-12T10:05:00-03:00", updated_at: "2026-11-12T10:05:00-03:00",
}

beforeEach(() => {
    m.sale = sale
    m.isError = false
    m.requestedIds = []
    m.candidates = []
    m.match.mockReset()
    m.unmatch.mockReset()
    m.openEntity.mockReset()
})

describe("TerminalSaleDrawer", () => {
    it("carga la venta por id y muestra las pestañas Detalle y Relacionados", () => {
        render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(m.requestedIds).toContain(9)
        expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Detalle", "Relacionados"])
        expect(screen.getByText("Venta 13347")).toBeInTheDocument()
    })

    it("Detalle muestra los campos, ítems, abonos y los datos originales plegados", async () => {
        render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("cash:13347")).toBeInTheDocument()
        expect(screen.getByText("39 · Boleta Electrónica")).toBeInTheDocument()
        expect(screen.getByText("Tipo DTE (ERP)")).toBeInTheDocument()
        expect(screen.getByText("BOLETA")).toBeInTheDocument()
        expect(screen.getByText("Ítems")).toBeInTheDocument()
        expect(screen.getByText("Abonos (conciliaciones)")).toBeInTheDocument()
        expect(screen.queryByText(/"saleId": "13347"/)).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /Mostrar/ }))
        expect(screen.getByText(/"saleId": "13347"/)).toBeInTheDocument()
    })

    it("Relacionados monta el tab de relaciones documentales de treasury.terminalsale", async () => {
        render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
        await userEvent.click(screen.getByRole("tab", { name: "Relacionados" }))
        expect(await screen.findByText("relations-tab treasury.terminalsale #9")).toBeInTheDocument()
    })

    it("si la carga falla muestra el error en el detalle", () => {
        m.sale = undefined
        m.isError = true
        render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("No se pudo cargar la venta")).toBeInTheDocument()
    })

    describe("Documento ERP", () => {
        it("con vínculo muestra el documento y abre billing.invoice", async () => {
            m.sale = { ...sale, match_status: "MATCHED", match_status_display: "Cuadrado", matched_invoice: 5, matched_invoice_display: "B-100" }
            render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("Documento ERP")).toBeInTheDocument()
            expect(screen.getByText("Cuadrado")).toBeInTheDocument()
            await userEvent.click(screen.getByRole("button", { name: "B-100" }))
            expect(m.openEntity).toHaveBeenCalledWith("billing.invoice", 5)
            expect(screen.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument()
        })

        it("sin vínculo lista candidatos y vincula", async () => {
            m.candidates = [{ id: 7, display_id: "B-200", dte_type: "BOLETA", total: "3200", date: "2026-11-12" }]
            render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
            expect(screen.getByText("B-200")).toBeInTheDocument()
            await userEvent.click(screen.getByRole("button", { name: "Vincular" }))
            expect(m.match).toHaveBeenCalledWith({ saleId: 9, invoiceId: 7 })
        })

        it("con vínculo manual ofrece Desvincular", async () => {
            m.sale = { ...sale, match_status: "MATCHED", match_status_display: "Cuadrado", matched_invoice: 5, matched_invoice_display: "B-100", matched_manually: true }
            render(<TerminalSaleDrawer id={9} open onOpenChange={vi.fn()} />)
            await userEvent.click(screen.getByRole("button", { name: "Desvincular" }))
            expect(m.unmatch).toHaveBeenCalledWith(9)
        })
    })
})
