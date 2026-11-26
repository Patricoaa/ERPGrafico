import * as React from "react"
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Collection, useEntityCollection } from "@/components/entity-view"
import type { Product } from "@/types/entities"
import { productVariantEntity, productVariantViews } from "../productVariant.entity"

const variant = (over: Partial<Product>): Product => ({
    id: 1, name: "Tarjeta", code: "T-1", internal_code: "TAR-ROJ", sale_price: 1000, current_stock: 4,
    price_inheritance_mode: "INHERIT", attribute_values_data: [{ id: 1, value: "Rojo" }], ...over,
} as unknown as Product)

const ROWS = [
    variant({}),
    variant({ id: 2, internal_code: "TAR-AZU", price_inheritance_mode: "OVERRIDE", current_stock: 0, mfg_auto_finalize: true }),
]

function Harness({ onSelected }: { onSelected: (ids: number[]) => void }) {
    const [ids, setIds] = React.useState<number[]>([])
    const selection = React.useMemo(() => ({
        state: Object.fromEntries(ids.map((id) => [String(id), true])),
        onChange: (next: Record<string, boolean>) => {
            const on = Object.entries(next).filter(([, v]) => v).map(([id]) => Number(id))
            setIds(on)
            onSelected(on)
        },
    }), [ids, onSelected])
    const collection = useEntityCollection(productVariantEntity, { rows: ROWS, rowCount: ROWS.length }, { pagination: { mode: "none" }, selection })
    return (
        <Collection.Root collection={collection} selection="bulk" label="Variantes">
            <Collection.View table={productVariantViews.table} />
        </Collection.Root>
    )
}

describe("productVariantEntity (ProductVariantsTab)", () => {
    it("shows price mode, BOM and stock as badges and selects through the controlled selection", async () => {
        const selected: number[][] = []
        render(<Harness onSelected={(ids) => selected.push(ids)} />)
        const blue = within(screen.getByText("TAR-AZU").closest("tr") as HTMLElement)
        expect(blue.getByText("Propio")).toBeInTheDocument()
        expect(blue.getByText("Sin LDM")).toBeInTheDocument()
        expect(blue.getByText("Stock: 0")).toBeInTheDocument()
        expect(within(screen.getByText("TAR-ROJ").closest("tr") as HTMLElement).getByText("Rojo")).toBeInTheDocument()

        await userEvent.click(within(screen.getByText("TAR-AZU").closest("tr") as HTMLElement).getByRole("checkbox"))
        expect(selected.at(-1)).toEqual([2])
    })
})
