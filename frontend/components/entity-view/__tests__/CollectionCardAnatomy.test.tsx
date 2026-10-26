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
    flag?: string
    archived?: boolean
}

const entity = defineEntity<Doc>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code("folio", { label: "Folio" }),
        name: f.text("name", { label: "Nombre" }),
        email: f.text("email", { label: "Email" }),
        total: f.money("total", { label: "Total" }),
        flag: f.text((d) => d.flag ?? "", { label: "Aviso" }),
    },
}))

const rows: Doc[] = [
    { id: 1, folio: "OV-0001", name: "Imprenta Sur", status: "PAID", total: 125000, email: "sur@imprenta.cl", flag: "Solo compra" },
    { id: 2, folio: "OV-0002", name: "Editorial Andes", status: "CANCELLED", total: 5000, email: "andes@editorial.cl", archived: true },
]

function Harness({ source, onOpen, withRail = true, railSide = "left", withFooter = true, catalog = false, bulk = false, slots = false }: { source: CollectionSource<Doc>; onOpen?: (row: Doc) => void; withRail?: boolean; railSide?: "left" | "right"; withFooter?: boolean; catalog?: boolean; bulk?: boolean; slots?: boolean }) {
    const collection = useEntityCollection(entity, source)
    const views = entity.views({
        card: {
            code: "folio",
            title: "name",
            meta: ["email"],
            ...(withFooter ? { footer: { value: "total" as const } } : {}),
            ...(withRail ? { rail: { status: (d: Doc) => d.status, icon: FileText, side: railSide } } : {}),
            ...(catalog ? { media: { placement: "top" as const, icon: FileText, ...(slots ? { badge: (d: Doc) => (d.archived ? "Archivado" : "Insumos"), footnote: (d: Doc) => (d.id === 1 ? "4 gramajes" : null) } : {}) } } : {}),
            ...(slots ? { highlights: ["flag" as const], muted: (d: Doc) => !!d.archived } : {}),
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
        // The title is the card's opener, not a text link: no underline competing with the ribbon + cursor.
        expect(open.className).toContain("hover:no-underline")
        expect(open.className).not.toContain("focus-visible:underline")
        // The overlay is a button: its own cursor would hide the card's pointer, so the surface sets it too.
        expect(open.closest('[data-slot="card"]')).toHaveClass("cursor-pointer", "[&_[data-card-open]]:cursor-pointer")
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

    it("can put the rail on the trailing edge for the compact document variant", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} railSide="right" />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const rail = first.querySelector('[aria-hidden="true"].w-14')
        expect(rail).toHaveClass("border-l", "order-last")
        expect(rail).not.toHaveClass("border-r")
    })

    it("uses an action-only footer without the amount padding when a catalog card has no value", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} withFooter={false} catalog />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const actions = within(first).getByRole("button", { name: "Acciones" })
        const foot = actions.parentElement?.parentElement as HTMLElement
        expect(foot.className).toContain("pt-0")
        expect(foot).not.toHaveTextContent("Total")
        expect(foot).not.toHaveTextContent("125.000")
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

    it("in bulk mode the card click still performs the primary action (open); only the checkbox selects", async () => {
        const user = userEvent.setup()
        const onOpen = vi.fn()
        render(<Harness source={{ rows }} onOpen={onOpen} withRail={false} catalog bulk />)
        const first = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")[0]
        const open = within(first).getByRole("button", { name: "Imprenta Sur" })
        expect(open.className).toContain("after:absolute")
        expect(first.querySelector("[data-card-select]")).toBeNull()
        await user.click(open)
        expect(onOpen).toHaveBeenCalledWith(rows[0])
        expect(within(first).getByRole("checkbox")).not.toBeChecked()
        await user.click(within(first).getByRole("checkbox"))
        expect(within(first).getByRole("checkbox")).toBeChecked()
        expect(onOpen).toHaveBeenCalledTimes(1)
    })


    it("highlights skip empty values, the media carries the badge and footnote, and archived cards are muted", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} catalog slots />)
        const [first, second] = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")
        expect(first).toHaveTextContent("Solo compra")
        expect(first).toHaveTextContent("4 gramajes")
        expect(first).toHaveTextContent("Insumos")
        expect(second).not.toHaveTextContent("Aviso")
        expect(second.textContent ?? "").not.toContain("Solo compra")
        expect(second).toHaveTextContent("Archivado")
        expect(first.firstElementChild).not.toHaveClass("opacity-70")
        expect(second.firstElementChild).toHaveClass("opacity-70")
    })
})
