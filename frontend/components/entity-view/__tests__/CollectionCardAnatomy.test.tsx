import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FileText } from "lucide-react"
import {
    Collection,
    EntityViewProvider,
    defineEntity,
    useEntityCollection,
    type CollectionSource,
} from "@/components/entity-view"

interface Doc {
    id: number
    folio: string
    name: string
    status: string
    total: number
    email: string
}

const entity = defineEntity<Doc>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code("folio", { label: "Folio" }),
        name: f.text("name", { label: "Nombre" }),
        email: f.text("email", { label: "Email" }),
        total: f.money("total", { label: "Total" }),
    },
}))

const rows: Doc[] = [
    { id: 1, folio: "OV-0001", name: "Imprenta Sur", status: "PAID", total: 125000, email: "sur@imprenta.cl" },
    { id: 2, folio: "OV-0002", name: "Editorial Andes", status: "CANCELLED", total: 5000, email: "andes@editorial.cl" },
]

function Harness({ source, onOpen, withRail = true, catalog = false, bulk = false }: { source: CollectionSource<Doc>; onOpen?: (row: Doc) => void; withRail?: boolean; catalog?: boolean; bulk?: boolean }) {
    const collection = useEntityCollection(entity, source)
    const views = entity.views({
        card: {
            code: "folio",
            title: "name",
            meta: ["email"],
            footer: { value: "total" },
            ...(withRail ? { rail: { status: (d: Doc) => d.status, icon: FileText } } : {}),
            ...(catalog ? { media: { placement: "top" as const, icon: FileText } } : {}),
        },
    })
    return (
        <EntityViewProvider opener={{ open: vi.fn(), labelOf: () => undefined }}>
            <Collection.Root collection={collection} onOpen={onOpen} label="Documentos" defaultView="card" selection={bulk ? "bulk" : "none"} actions={() => <button type="button">Acciones</button>}>
                <Collection.View card={views.card} />
            </Collection.Root>
        </EntityViewProvider>
    )
}

describe("Collection card anatomy (ADR-0097)", () => {
    it("shows the mono code above the title and the footer caption with the amount", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        expect(first).toHaveTextContent("OV-0001")
        expect(within(first).getByText("Total")).toBeInTheDocument()
        expect(first).toHaveTextContent("125.000")
    })

    it("opens the record from the title button, which is stretched over the whole card", async () => {
        const user = userEvent.setup()
        const onOpen = vi.fn()
        render(<Harness source={{ rows }} onOpen={onOpen} />)
        const open = screen.getByRole("button", { name: "Imprenta Sur" })
        expect(open).toHaveAttribute("data-card-open")
        expect(open.className).toContain("after:absolute")
        await user.click(open)
        expect(onOpen).toHaveBeenCalledWith(rows[0])
    })

    it("keeps row actions as siblings above the stretched link (AX-4)", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const list = screen.getByRole("list", { name: "Documentos" })
        expect(list.querySelector('[role="button"] button')).toBeNull()
        const actions = within(list).getAllByRole("button", { name: "Acciones" })[0]
        expect(actions.parentElement?.className).toContain("z-10")
    })

    it("renders a decorative left rail with the entity icon whose tint follows the status", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const items = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")
        const rails = items.map((li) => li.querySelector('[aria-hidden="true"].w-14'))
        expect(rails[0]).not.toBeNull()
        expect(rails[0]?.className).toContain("border-r")
        expect(rails[0]?.className).toContain("text-success")
        expect(rails[0]?.querySelector("svg")).not.toBeNull()
        expect(rails[1]?.className).not.toContain("text-success")
        // The rail replaces the icon tile of the title row.
        expect(items[0].querySelector(".self-stretch.w-10")).toBeNull()
    })

    it("has no rail when the layout does not declare one", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} />)
        expect(screen.getByRole("list", { name: "Documentos" }).querySelector(".w-14")).toBeNull()
    })

    it("catalog cards put the bulk checkbox on the media corner and the kebab in the footer", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} catalog bulk />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const corner = first.querySelector(".absolute.right-2.top-2")
        expect(corner).not.toBeNull()
        expect(within(corner as HTMLElement).getByRole("checkbox")).toBeInTheDocument()
        const kebab = within(first).getByRole("button", { name: "Acciones" })
        // Footer, not header: the kebab lives next to the amount and replaces the open chevron.
        expect(kebab.parentElement?.previousElementSibling?.textContent).toContain("125.000")
    })

    it("catalog grids use container-query columns (4-5 on wide grids)", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} catalog />)
        const list = screen.getByRole("list", { name: "Documentos" })
        expect(list.className).toContain("@4xl:grid-cols-[repeat(4,minmax(0,1fr))]")
        expect(list.className).toContain("@7xl:grid-cols-[repeat(5,minmax(0,1fr))]")
    })

    it("cards use the product-grid selection language: ribbon on hover, ribbon when bulk-selected", async () => {
        const user = userEvent.setup()
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} catalog bulk />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const card = first.firstElementChild as HTMLElement
        expect(card).toHaveClass("ribbon-cmyk", "ribbon-cmyk-hover", "cursor-pointer")
        // Looks pressable but is not the control: no role, no tab stop, no pressed state.
        expect(card).not.toHaveAttribute("role")
        expect(card).not.toHaveAttribute("aria-pressed")
        await user.click(within(first).getByRole("checkbox"))
        expect(first.firstElementChild).toHaveClass("ribbon-cmyk")
        expect(first.firstElementChild).not.toHaveClass("ribbon-cmyk-hover")
        expect(first.firstElementChild?.className).toContain("border-primary")
    })

    it("in bulk mode clicking the card selects it (first action) while the title still opens it", async () => {
        const user = userEvent.setup()
        const onOpen = vi.fn()
        render(<Harness source={{ rows }} onOpen={onOpen} withRail={false} catalog bulk />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const overlay = first.querySelector("[data-card-select]") as HTMLElement
        expect(overlay).not.toBeNull()
        expect(overlay).toHaveAttribute("aria-hidden", "true")
        await user.click(overlay)
        expect(within(first).getByRole("checkbox")).toBeChecked()
        expect(onOpen).not.toHaveBeenCalled()
        await user.click(within(first).getByRole("button", { name: "Imprenta Sur" }))
        expect(onOpen).toHaveBeenCalledWith(rows[0])
    })

    it("without bulk selection the title is the stretched link and there is no select overlay", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        expect(first.querySelector("[data-card-select]")).toBeNull()
        expect(within(first).getByRole("button", { name: "Imprenta Sur" }).className).toContain("after:absolute")
    })
})
