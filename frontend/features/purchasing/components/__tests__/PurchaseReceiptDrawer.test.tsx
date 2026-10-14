import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { PurchaseReceiptDrawer } from "../PurchaseReceiptDrawer"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/lib/api", () => ({
    default: { get: getMock },
}))

vi.mock("@/components/providers/GlobalModalProvider", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useGlobalModals: () => ({ openEntity: vi.fn() }),
}))

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const wrap =(ui: React.ReactElement) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {ui}
        </QueryClientProvider>
    )

/**
 * GAP-06 (auditoría documental): despacho y recepción se abrían con
 * InventoryDocumentDrawer usando un id de otra tabla. Cada drawer debe pedir
 * su propio endpoint con el id recibido.
 */
describe("logistics document drawers", () => {
    beforeEach(() => getMock.mockReset())

    it("PurchaseReceiptDrawer fetches the receipt endpoint, not an inventory document", async () => {
        getMock.mockResolvedValue({
            data: {
                id: 7, number: "12", status: "CONFIRMED", receipt_date: "2026-10-01",
                supplier_name: "Papelera Sur", warehouse_name: "Central",
                purchase_order: 3, purchase_order_number: "40", lines: [],
            },
        })

        wrap(<PurchaseReceiptDrawer id={7} open onOpenChange={() => {}} />)

        await waitFor(() => expect(screen.getByText("Papelera Sur")).toBeInTheDocument())
        const urls = getMock.mock.calls.map((c) => String(c[0]))
        expect(urls).toContain("/purchasing/receipts/7/")
        expect(urls.some((u) => u.includes("/inventory/"))).toBe(false)
    })
})
