import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"
import { Collection, useEntityCollection, type CollectionSource } from "@/components/entity-view"
import { openEntityAction, withEntityView } from "@/components/entity-view/stories/withEntityView"
import type { UoM } from "../hooks/useUoMs"
import { uomEntity, uomViews } from "./uom.entity"

const UOMS: UoM[] = [
    { id: 1, name: "Unidad", name_singular: "unidad", name_plural: "unidades", abbreviation: "u", category: 1, category_name: "Unidades", uom_type: "REFERENCE", ratio: "1.00", rounding: "1", is_active: true },
    { id: 2, name: "Docena", name_singular: "docena", name_plural: "docenas", abbreviation: "doc", category: 1, category_name: "Unidades", uom_type: "BIGGER", ratio: "12.00", rounding: "1", is_active: true },
    { id: 3, name: "Kilogramo", name_singular: "kilogramo", name_plural: "kilogramos", abbreviation: "kg", category: 2, category_name: "Peso", uom_type: "REFERENCE", ratio: "1.00", rounding: "0.01", is_active: true },
    { id: 4, name: "Gramo", name_singular: "gramo", name_plural: "gramos", abbreviation: "g", category: 2, category_name: "Peso", uom_type: "SMALLER", ratio: "0.001", rounding: "0.01", is_active: true },
    { id: 5, name: "Resma", name_singular: "resma", name_plural: "resmas", abbreviation: "rsm", category: 1, category_name: "Unidades", uom_type: "BIGGER", ratio: "500.00", rounding: "1", is_active: true },
]

/** The whole page body of UoMClientView in the new system (2 files, no custom code). */
function UoMCollection({ source, defaultView }: { source: CollectionSource<UoM>; defaultView?: "table" | "card" }) {
    const collection = useEntityCollection(uomEntity, source, { defaultSort: uomViews.table.defaultSort })
    return (
        <Collection.Root collection={collection} selection="bulk" defaultView={defaultView}>
            <Collection.Toolbar />
            <Collection.View table={uomViews.table} card={uomViews.card} />
        </Collection.Root>
    )
}

const meta = {
    title: "Entity view/UoM (trivial)",
    component: UoMCollection,
    decorators: [withEntityView],
    args: { source: { rows: UOMS } },
} satisfies Meta<typeof UoMCollection>
export default meta
type Story = StoryObj<typeof meta>

export const Table: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(canvas.getAllByRole("table")).toHaveLength(1)
        await userEvent.click(canvas.getByRole("button", { name: "Docena" }))
        await expect(openEntityAction).toHaveBeenCalledWith("inventory.uom", 2, UOMS[1])
    },
}
export const Cards: Story = { args: { defaultView: "card" } }
export const Loading: Story = { args: { source: { rows: undefined, isLoading: true } } }
export const Empty: Story = { args: { source: { rows: [] } } }
export const Error: Story = { args: { source: { rows: undefined, error: new globalThis.Error("Error 500 del servidor") } } }
export const Dark: Story = { globals: { theme: "dark" } }
export const Comfortable: Story = { globals: { density: "comfortable" } }
