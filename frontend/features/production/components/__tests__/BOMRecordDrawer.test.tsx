import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { BOMRecordDrawer } from "../BOMRecordDrawer"

const m = vi.hoisted(() => ({ data: undefined as unknown, isError: false, drawer: vi.fn() }))

vi.mock("../../hooks/useBOMs", () => ({ useBOM: (id: number) => ({ data: m.data, isError: m.isError, id }) }))
vi.mock("@/components/shared", () => ({ SkeletonShell: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} /> }))
vi.mock("../BOMDrawer", () => ({
    BOMDrawer: (props: { bomToEdit: { id: number }; product: { id: number; name: string; code: string } }) => {
        m.drawer(props)
        return <div>bom:{props.bomToEdit.id}:{props.product.name}:{props.product.code}</div>
    },
}))

describe("BOMRecordDrawer (ADR-0152)", () => {
    beforeEach(() => { m.data = undefined; m.isError = false; m.drawer.mockReset() })

    it("shows a skeleton while the BOM loads", () => {
        render(<BOMRecordDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByLabelText("Cargando lista de materiales")).toBeInTheDocument()
        expect(m.drawer).not.toHaveBeenCalled()
    })

    it("opens the BOM in edit with the product derived from it", () => {
        m.data = { id: 5, product: 9, product_name: "Tarjeta", product_code: "TAR-1" }
        render(<BOMRecordDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(screen.getByText("bom:5:Tarjeta:TAR-1")).toBeInTheDocument()
    })

    it("renders nothing when the BOM cannot be loaded (never a creation form)", () => {
        m.isError = true
        const { container } = render(<BOMRecordDrawer id={5} open onOpenChange={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
})
