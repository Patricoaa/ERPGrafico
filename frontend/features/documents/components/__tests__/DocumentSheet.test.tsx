import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { Package } from "lucide-react"

import { DocumentSheet } from "../DocumentSheet"

const { getMock, setEntityDisplayMock } = vi.hoisted(() => ({ getMock: vi.fn(), setEntityDisplayMock: vi.fn() }))

vi.mock("@/lib/api", () => ({ default: { get: getMock } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({
    useGlobalModals: () => ({ openEntity: vi.fn(), setEntityDisplay: setEntityDisplayMock }),
}))
vi.mock("@/lib/entity-drawers", () => ({ hasEntityDrawer: () => true }))
vi.mock("@/features/audit", () => ({ ActivitySidebar: () => <aside>actividad</aside> }))

const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

/** ADR-0083 U5: ficha documental estándar. */
describe("DocumentSheet", () => {
    beforeEach(() => {
        getMock.mockReset()
        setEntityDisplayMock.mockReset()
        getMock.mockResolvedValue({ data: { document: {}, relations: [], unresolved: [] } })
    })

    it("renders context, sections, status and tabs; registers its number in the stack", () => {
        wrap(
            <DocumentSheet
                label="sales.saledelivery"
                open
                embedded
                onOpenChange={vi.fn()}
                document={{ id: 7, display_id: "DES-000007" }}
                status="CONFIRMED"
                context={[{ label: "Cliente", value: "Imprenta Norte" }, { label: "Bodega", value: "Central" }]}
                sections={[{ title: "Productos", icon: Package, content: <p>tabla-de-productos</p> }]}
                auditType="sale_delivery"
            />,
        )
        expect(screen.getByText("Imprenta Norte")).toBeInTheDocument()
        expect(screen.getByText("tabla-de-productos")).toBeInTheDocument()
        expect(screen.getByText("Resumen")).toBeInTheDocument()
        expect(screen.getByText("Relaciones")).toBeInTheDocument()
        expect(setEntityDisplayMock).toHaveBeenCalledWith("sales.saledelivery", 7, "DES-000007")
    })

    it("shows the loading skeleton while the document loads", () => {
        wrap(<DocumentSheet label="inventory.stockmove" open embedded onOpenChange={vi.fn()} document={null} isLoading context={[]} loadingLabel="Cargando movimiento" />)
        expect(screen.getByLabelText("Cargando movimiento")).toBeInTheDocument()
    })
})
