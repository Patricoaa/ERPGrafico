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

function Harness({ source, onOpen, withRail = true }: { source: CollectionSource<Doc>; onOpen?: (row: Doc) => void; withRail?: boolean }) {
    const collection = useEntityCollection(entity, source)
    const views = entity.views({
        card: {
            code: "folio",
            title: "name",
            meta: ["email"],
            footer: { value: "total" },
            ...(withRail ? { rail: { status: (d: Doc) => d.status, icon: FileText } } : {}),
        },
    })
    return (
        <EntityViewProvider opener={{ open: vi.fn(), labelOf: () => undefined }}>
            <Collection.Root collection={collection} onOpen={onOpen} label="Documentos" defaultView="card" actions={() => <button type="button">Acciones</button>}>
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

    it("renders a decorative state rail whose tone follows the status", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} />)
        const items = within(screen.getByRole("list", { name: "Documentos" })).getAllByRole("listitem")
        const rails = items.map((li) => li.querySelector('[aria-hidden="true"].w-14'))
        expect(rails[0]).not.toBeNull()
        expect(rails[0]?.className).toContain("text-success")
        expect(rails[1]?.className).not.toContain("text-success")
    })

    it("has no rail when the layout does not declare one", () => {
        render(<Harness source={{ rows }} onOpen={vi.fn()} withRail={false} />)
        expect(screen.getByRole("list", { name: "Documentos" }).querySelector(".w-14")).toBeNull()
    })
})
