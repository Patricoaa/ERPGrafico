import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"

import { DocumentResolverView } from "../DocumentResolverView"

const { getMock, replaceMock, openEntityMock } = vi.hoisted(() => ({
    getMock: vi.fn(), replaceMock: vi.fn(), openEntityMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({ default: { get: getMock } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: openEntityMock }),
}))
vi.mock("@/lib/entity-drawers", () => ({ hasEntityDrawer: (label: string) => label === "sales.saledelivery" }))

const ref = (overrides: Record<string, unknown>) => ({
    label: "sales.saledelivery", id: 9, display_id: "DES-9", title: "Despacho", icon: null,
    status: "CONFIRMED", status_display: "Confirmado", date: "2026-10-02", partner_name: "Imprenta Norte",
    url: "/d/sales.saledelivery/9", accessible: true, exists: true, ...overrides,
})

const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

/** ADR-0080: resolvedor /d/{label}/{id}. */
describe("DocumentResolverView", () => {
    beforeEach(() => { getMock.mockReset(); replaceMock.mockReset(); openEntityMock.mockReset() })

    it("redirects to the canonical list URL when the type has one", async () => {
        getMock.mockResolvedValue({ data: ref({ label: "sales.saleorder", id: 4, url: "/sales/orders?selected=4" }) })

        wrap(<DocumentResolverView label="sales.saleorder" id={4} />)

        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/sales/orders?selected=4"))
        expect(getMock).toHaveBeenCalledWith("/core/documents/sales.saleorder/4/")
        expect(openEntityMock).not.toHaveBeenCalled()
    })

    it("opens the registered drawer when the canonical URL is the resolver itself", async () => {
        getMock.mockResolvedValue({ data: ref({}) })

        wrap(<DocumentResolverView label="sales.saledelivery" id={9} />)

        await waitFor(() => expect(openEntityMock).toHaveBeenCalledWith("sales.saledelivery", 9))
        expect(openEntityMock).toHaveBeenCalledTimes(1)
        expect(replaceMock).not.toHaveBeenCalled()
        expect(screen.getByText("DES-9")).toBeInTheDocument()
    })

    it("shows an error state when the document cannot be resolved", async () => {
        getMock.mockRejectedValue(new Error("Documento no encontrado."))

        wrap(<DocumentResolverView label="sales.saledelivery" id={999} />)

        await waitFor(() => expect(screen.getByText("No se pudo abrir el documento")).toBeInTheDocument())
        expect(openEntityMock).not.toHaveBeenCalled()
    })
})
