import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { SaleDeliveryDrawer } from "../SaleDeliveryDrawer"

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock("@/lib/api", () => ({
    default: { get: getMock },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

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
describe("SaleDeliveryDrawer", () => {
    beforeEach(() => getMock.mockReset())

    it("SaleDeliveryDrawer fetches the delivery endpoint, not an inventory document", async () => {
        getMock.mockResolvedValue({
            data: {
                id: 9, number: "5", status: "CONFIRMED", delivery_date: "2026-10-02",
                customer_name: "Imprenta Norte", warehouse_name: "Central",
                sale_order: 4, sale_order_number: "77", lines: [],
            },
        })

        wrap(<SaleDeliveryDrawer id={9} open onOpenChange={() => {}} />)

        await waitFor(() => expect(screen.getByText("Imprenta Norte")).toBeInTheDocument())
        const urls = getMock.mock.calls.map((c) => String(c[0]))
        expect(urls).toContain("/sales/deliveries/9/")
        expect(urls.some((u) => u.includes("/inventory/"))).toBe(false)
    })
})
