import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { InvoiceRegistrationModal } from "../InvoiceRegistrationModal"
import { ATTACHMENT_REQUIRED_DTE } from "../../schema"

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))

vi.mock("@/lib/api", () => ({ default: { get: getMock, post: postMock } }))
vi.mock("@/hooks/useServerDate", () => ({ useServerDate: () => ({ dateString: "2026-11-04", serverDate: null, isLoading: false }) }))
vi.mock("@/features/realtime", () => ({ useRealtime: () => ({ markLocalMutation: vi.fn() }) }))
vi.mock("@/hooks/usePeriodValidation", () => ({
    usePeriodValidation: () => ({
        validatePeriod: vi.fn(),
        validatePeriodImmediate: vi.fn(),
        clearPeriodValidation: vi.fn(),
        isClosed: false,
        message: "",
    }),
}))
vi.mock("@/hooks/useFolioValidation", () => ({
    useFolioValidation: () => ({ isValid: true, isLoading: false, message: "", validateFolio: vi.fn(), isValidating: false, validationResult: null, clearValidation: vi.fn() }),
}))

// The SII/RCV picker is a heavy, lazy feature panel; a stub lets the tests pick a fiscal match.
vi.mock("@/features/tax", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/tax")>()),
    FiscalMatchPickerPanel: ({ onAssign }: { onAssign: (matchId: number, folio: string) => void }) => (
        <button type="button" onClick={() => onAssign(9, "12345")}>Asignar documento RCV</button>
    ),
}))

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const ORDERS = [{
    order_id: 7, display_id: "OC-000007", partner_id: 20, invoicing_status: "PARTIAL",
    lines: [
        {
            id: 31, product_id: 1, description: "Producto A", quantity: "10",
            quantity_invoiced: "0", pending: "10", deliverable: false, fulfillments: [],
        },
    ],
}]

const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

/** ADR-0081 unification: single modal replaces invoice-by-lines + complete-folio two-step flow. */
describe("InvoiceRegistrationModal", () => {
    beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

    it("a purchase invoice is registered from the SII/RCV only (no manual folio, commit 3c179bded)", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} defaultMode="manual" />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        expect(screen.getByText(/seleccione el documento del rcv/i)).toBeInTheDocument()
        expect(await screen.findByRole("button", { name: /asignar documento rcv/i })).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/ej: 45223/i)).not.toBeInTheDocument()
        expect(screen.queryByRole("tab", { name: /registro manual/i })).not.toBeInTheDocument()
    })

    it("a purchase boleta keeps the manual tab with folio and attachment fields", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} initialDteType="BOLETA" defaultMode="manual" />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        expect(screen.getByRole("tab", { name: /registro manual/i })).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/ej: 45223/i)).toBeInTheDocument()
        expect(screen.getAllByText(/adjunto/i).length).toBeGreaterThan(0)
    })

    it("ATTACHMENT_REQUIRED_DTE includes both FACTURA and PURCHASE_INV", () => {
        expect(ATTACHMENT_REQUIRED_DTE.has("FACTURA")).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has("PURCHASE_INV")).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has("BOLETA")).toBe(false)
        expect(ATTACHMENT_REQUIRED_DTE.has("BOLETA_EXENTA")).toBe(false)
    })

    it("auto-fills all pending quantities on load", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} defaultMode="manual" />)
        // Open the lines section first
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        // Click to expand the lines section
        const toggleBtn = await waitFor(() => screen.getByRole("button", { name: /cantidades a facturar/i }))
        await userEvent.click(toggleBtn)
        // Producto A with pending=10 should be pre-filled
        await waitFor(() => expect(screen.getByDisplayValue("10")).toBeInTheDocument())
    })

    it("shows and hides the lines section with the toggle", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} defaultMode="manual" />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        // Lines section starts collapsed — product name not visible
        expect(screen.queryByText(/producto a/i)).not.toBeInTheDocument()
        // Click toggle to expand
        const toggleBtn = await waitFor(() => screen.getByRole("button", { name: /cantidades a facturar/i }))
        await userEvent.click(toggleBtn)
        await waitFor(() => expect(screen.getByText(/producto a/i)).toBeInTheDocument())
        // Click again to collapse
        await userEvent.click(toggleBtn)
        await waitFor(() => expect(screen.queryByText(/producto a/i)).not.toBeInTheDocument())
    })

    it("hides attachment requirement in pending mode", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} defaultMode="manual" />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        // Click the emit later switch
        const switchBtn = screen.getByRole("switch")
        await userEvent.click(switchBtn)
        // In pending mode, attachment section is hidden — no "obligatorio" text
        expect(screen.queryByText(/obligatorio/i)).not.toBeInTheDocument()
        // Submit button should be enabled
        expect(screen.getByRole("button", { name: /registrar documento/i })).not.toBeDisabled()
    })

    it("registers from the RCV: from-lines, links the fiscal match, confirms with the SII folio", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        postMock
            .mockResolvedValueOnce({ data: { id: 55, display_id: "OC-FACV-55" } })   // from-lines
            .mockResolvedValueOnce({ data: { id: 9 } })                              // fiscal match apply
            .mockResolvedValueOnce({ data: { id: 55, display_id: "OC-FACV-55" } })   // confirm
        const onSuccess = vi.fn()
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} onSuccess={onSuccess} defaultMode="manual" />)
        await userEvent.click(await screen.findByRole("button", { name: /asignar documento rcv/i }))

        await userEvent.click(screen.getByRole("button", { name: /registrar documento/i }))

        await waitFor(() => {
            expect(postMock).toHaveBeenCalledTimes(3)
            expect(postMock.mock.calls[0][0]).toBe("/billing/invoices/from-lines/")
            expect(postMock.mock.calls[1][0]).toMatch(/\/9\/apply\/$/)
            expect(postMock.mock.calls[2][0]).toBe("/billing/invoices/55/confirm/")
            expect((postMock.mock.calls[2][1] as FormData).get("number")).toBe("12345")
            expect(onSuccess).toHaveBeenCalled()
        })
    })

    it("calls only from-lines in pending mode", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        postMock.mockResolvedValue({ data: { id: 56, display_id: "OC-FACV-56" } })
        const onSuccess = vi.fn()
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} onSuccess={onSuccess} defaultMode="manual" />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())

        const switchBtn = screen.getByRole("switch")
        await userEvent.click(switchBtn)
        await userEvent.click(screen.getByRole("button", { name: /registrar documento/i }))

        await waitFor(() => {
            expect(postMock).toHaveBeenCalledTimes(1)
            expect(postMock.mock.calls[0][0]).toBe("/billing/invoices/from-lines/")
            expect(onSuccess).toHaveBeenCalled()
        })
    })
})
