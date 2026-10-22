import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { withEntityView } from "@/components/entity-view/stories/withEntityView"
import { Button } from "@/components/ui/button"
import type { SaleOrderLine } from "../types"
import { mfgDetailLineEntity, mfgDetailLineViews, getMfgLineSubType, type ManufacturableLine } from "./mfgDetailLine.entity"

const LINES = [
    { id: 1, originalIndex: 0, product_name: "Tarjetas de presentación 4/4", internal_code: "P-0042", code: "TAR-PRE", qty: 1000, product_type: "MANUFACTURABLE", requires_advanced_manufacturing: true, manufacturing_data: { paper: "Couché 300 g" } },
    { id: 2, originalIndex: 1, product_name: "Volantes A5 full color", internal_code: "P-0043", code: "VOL-A5", qty: 5000, product_type: "MANUFACTURABLE", requires_advanced_manufacturing: true },
    { id: 3, originalIndex: 2, product_name: "Sellos autoentintables", internal_code: "P-0051", code: "SEL-AUT", qty: 12, product_type: "MANUFACTURABLE", mfg_auto_finalize: true },
    { id: 4, originalIndex: 3, product_name: "Etiquetas adhesivas", internal_code: "P-0060", code: "ETI-ADH", qty: 300, product_type: "MANUFACTURABLE" },
] as unknown as ManufacturableLine[] // fixtures carry only the fields the views read

function MfgLines({ view }: { view: "table" | "card" }) {
    const collection = useEntityCollection(mfgDetailLineEntity, { rows: LINES }, { pagination: { mode: "none" } })
    return (
        <div className="w-[48rem]">
            <Collection.Root
                collection={collection}
                defaultView={view}
                label="Líneas fabricables"
                actions={(row) => {
                    if (getMfgLineSubType(row as SaleOrderLine) !== "ADVANCED") return null
                    const configured = Boolean((row as ManufacturableLine).manufacturing_data)
                    return <Button size="sm" variant={configured ? "outline" : "default"} className="h-7 text-3xs">{configured ? "Editar" : "Configurar"}</Button>
                }}
            >
                <Collection.View table={mfgDetailLineViews.table} card={mfgDetailLineViews.card} />
            </Collection.Root>
        </div>
    )
}

const meta = {
    title: "Entity view/Fabricación del checkout",
    component: MfgLines,
    decorators: [withEntityView],
    args: { view: "card" },
} satisfies Meta<typeof MfgLines>
export default meta
type Story = StoryObj<typeof meta>

export const Cards: Story = {}
export const CardsDark: Story = { globals: { theme: "dark" } }
export const Table: Story = { args: { view: "table" } }
