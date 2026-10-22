import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"
import type { BaseProduct } from "@/features/inventory"
import { ProductCard, type ProductCardProps } from "./ProductCard"

const base = { sale_price: 1000, uom_name: "Pliego" } as const

const AVAILABLE: BaseProduct = { ...base, id: 1, code: "PAP-014", name: "Papel offset blanco 90 g", product_type: "STORABLE", qty_available: 3600 }
const WITH_VARIANTS: BaseProduct = {
    ...base, id: 2, code: "PAP-001", name: "Papel couché mate 150 g", product_type: "STORABLE",
    has_variants: true, variants_count: 4, variant_axis_label: "Gramaje", min_variant_price: 480,
}
const FAVORITE: BaseProduct = { ...base, id: 3, code: "TIN-003", name: "Tinta offset cian proceso", product_type: "STORABLE", qty_available: 12.5, uom_name: "Kg", is_favorite: true }
const DYNAMIC: BaseProduct = {
    ...base, id: 4, code: "IMP-021", name: "Impresión digital color A3", product_type: "SERVICE",
    is_dynamic_pricing: true, sale_price: 850, uom_name: "Cara", has_variants: true, variants_count: 6,
}
const OUT_OF_STOCK: BaseProduct = { ...base, id: 5, code: "TIN-004", name: "Tinta offset magenta proceso", product_type: "STORABLE", qty_available: 0, uom_name: "Kg" }

const meta = {
    title: "Selectors/ProductCard",
    component: ProductCard,
    args: {
        product: AVAILABLE,
        categoryName: "Papeles",
        categoryIcon: "Layers",
        isDisabled: false,
        isSelected: false,
        isTouch: false,
        onProductClick: fn(),
        onToggleFavorite: fn(),
    },
    decorators: [(Story) => <div className="w-[17rem]"><Story /></div>],
} satisfies Meta<typeof ProductCard>
export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {}
export const Selected: Story = { args: { product: WITH_VARIANTS, isSelected: true } }
export const Favorite: Story = { args: { product: FAVORITE, categoryName: "Tintas", categoryIcon: "Droplet" } }
export const VariantsAndDynamicPrice: Story = { args: { product: DYNAMIC, categoryName: "Impresión", categoryIcon: "Printer" } }
export const Disabled: Story = { args: { product: OUT_OF_STOCK, categoryName: "Tintas", categoryIcon: "Droplet", isDisabled: true } }
export const NoVariants: Story = {
    args: {
        product: { ...WITH_VARIANTS, id: 6, name: "Papel kraft 120 g", variants_count: 0, min_variant_price: null },
    },
}
export const CalculatorCost: Story = {
    args: {
        product: AVAILABLE,
        priceLabel: "Costo",
        priceRenderer: () => <><span className="text-lg font-semibold tabular-nums">$ 310</span><span className="ml-1 text-2xs text-muted-foreground">/ pliego</span></>,
    },
}
export const TouchTablet: Story = { args: { isTouch: true, product: WITH_VARIANTS } }

/** The five states side by side, as in the design reference. */
export const Anatomy: Story = {
    render: (args) => {
        const cards: Array<[string, Partial<ProductCardProps>]> = [
            ["available", {}],
            ["selected", { product: WITH_VARIANTS, isSelected: true }],
            ["favorite", { product: FAVORITE, categoryName: "Tintas", categoryIcon: "Droplet" }],
            ["variants", { product: DYNAMIC, categoryName: "Impresión", categoryIcon: "Printer" }],
            ["disabled", { product: OUT_OF_STOCK, categoryName: "Tintas", categoryIcon: "Droplet", isDisabled: true }],
            ["no-variants", { product: { ...WITH_VARIANTS, id: 6, name: "Papel kraft 120 g", variants_count: 0 } }],
        ]
        return (
            <div className="grid w-[86rem] grid-cols-6 gap-3">
                {cards.map(([key, overrides]) => <ProductCard key={key} {...args} {...overrides} />)}
            </div>
        )
    },
}

export const AnatomyDark: Story = { ...Anatomy, globals: { theme: "dark" } }
