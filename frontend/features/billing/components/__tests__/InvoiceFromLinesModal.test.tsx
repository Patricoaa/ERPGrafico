import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { InvoiceFromLinesModal } from "../InvoiceFromLinesModal"

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))

vi.mock("@/lib/api", () => ({ default: { get: getMock, post: postMock } }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-10-15", serverDate: null, isLoading: false }) }))
vi.mock("@/features/realtime", () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const ORDERS = [{
    order_id: 4, display_id: "OV-000004", partner_id: 10, invoicing_status: "PARTIAL",
    lines: [
        {
            id: 11, product_id: 1, description: "Afiche", quantity: "5", quantity_invoiced: "2", pending: "3",
            deliverable: true,
            fulfillments: [{ id: 21, document_id: 7, document_display: "DES-7", date: "2026-10-02", delivered: "3", invoiced: "0", pending: "3" }],
        },
        { id: 12, product_id: 2, description: "Diseño", quantity: "1", quantity_invoiced: "0", pending: "1", deliverable: false, fulfillments: [] },
    ],
}]

const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

/** ADR-0081 (M4c): facturación por entregas / multi-orden. */
describe("InvoiceFromLinesModal", () => {
    beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

    it("loads pending lines per delivery and submits the selected quantities", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        postMock.mockResolvedValue({ data: { id: 99, display_id: "FACV-Draft" } })
        const onSuccess = vi.fn()

        wrap(<InvoiceFromLinesModal open onOpenChange={vi.fn()} side="sale" orderId={4} partnerId={10} onSuccess={onSuccess} />)

        await waitFor(() => expect(screen.getByText("OV-000004")).toBeInTheDocument())
        expect(getMock).toHaveBeenCalledWith("/billing/invoices/invoiceable-lines/", { params: { side: "sale", orders: "4" } })

        fireEvent.click(screen.getByText("Facturar todo lo pendiente"))
        fireEvent.click(screen.getByText("Crear borrador"))

        await waitFor(() => expect(postMock).toHaveBeenCalled())
        const [url, payload, config] = postMock.mock.calls[0] as [string, unknown, { headers: Record<string, string> }]
        expect(url).toBe("/billing/invoices/from-lines/")
        expect(payload).toMatchObject({
            side: "sale", dte_type: "FACTURA", status: "DRAFT",
            items: [
                { order_line_id: 11, quantity: 3, fulfillment_line_id: 21 },
                { order_line_id: 12, quantity: 1, fulfillment_line_id: null },
            ],
        })
        expect(config.headers["Idempotency-Key"]).toBeTruthy()
        await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    })

    it("shows the empty state when nothing is pending", async () => {
        getMock.mockResolvedValue({ data: [] })
        wrap(<InvoiceFromLinesModal open onOpenChange={vi.fn()} side="sale" orderId={4} />)
        await waitFor(() => expect(screen.getByText("No hay cantidades pendientes de facturar")).toBeInTheDocument())
    })
})
