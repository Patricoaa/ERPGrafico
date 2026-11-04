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

    it("renders DTE type selector and folio/date/attachment fields", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} />)
        // Wait for the modal to render — LabeledSelect uses fieldset/legend, find by role heading or text
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        expect(screen.getByText(/n° de folio/i)).toBeInTheDocument()
        expect(screen.getAllByText(/adjunto/i).length).toBeGreaterThan(0)
    })

    it("requires attachment for FACTURA on purchase side", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        // dteType defaults to FACTURA — attachment label should say "obligatorio"
        expect(screen.getByText(/obligatorio/i)).toBeInTheDocument()
    })

    it("ATTACHMENT_REQUIRED_DTE includes both FACTURA and PURCHASE_INV", () => {
        expect(ATTACHMENT_REQUIRED_DTE.has("FACTURA")).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has("PURCHASE_INV")).toBe(true)
        expect(ATTACHMENT_REQUIRED_DTE.has("BOLETA")).toBe(false)
        expect(ATTACHMENT_REQUIRED_DTE.has("BOLETA_EXENTA")).toBe(false)
    })

    it("hides attachment requirement in pending mode", async () => {
        getMock.mockResolvedValue({ data: ORDERS })
        wrap(<InvoiceRegistrationModal open onOpenChange={vi.fn()} side="purchase" orderId={7} partnerId={20} />)
        await waitFor(() => expect(screen.getByText(/tipo de documento/i)).toBeInTheDocument())
        // Click the pending checkbox
        await userEvent.click(screen.getByLabelText(/aún no tengo/i))
        // In pending mode, attachment section is hidden — no "obligatorio" text
        expect(screen.queryByText(/obligatorio/i)).not.toBeInTheDocument()
        // Submit button should be enabled
        expect(screen.getByRole("button", { name: /registrar documento/i })).not.toBeDisabled()
    })
})
