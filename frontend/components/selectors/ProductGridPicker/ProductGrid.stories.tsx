import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"
import type { BaseProduct, ProductCategory } from "@/features/inventory"
import { ProductGrid } from "./ProductGrid"

const CATEGORIES: ProductCategory[] = [
    { id: 1, name: "Papeles", icon: "Layers" },
    { id: 2, name: "Tintas", icon: "Droplet" },
    { id: 3, name: "Impresión", icon: "Printer" },
    { id: 4, name: "Terminaciones", icon: "Scissors" },
]

const NAMES = [
    "Papel offset blanco 90 g", "Papel couché mate 150 g", "Tinta offset cian proceso", "Impresión digital color A3",
    "Tinta offset magenta proceso", "Laminado mate BOPP", "Corte guillotina", "Papel bond 75 g carta",
    "Tinta offset amarillo proceso", "Barniz UV sectorizado", "Papel adhesivo semibrillo", "Plancha CTP térmica",
]

const PRODUCTS: BaseProduct[] = Array.from({ length: 24 }, (_, i) => {
    const categoryId = (i % 4) + 1
    const isService = categoryId === 3 || categoryId === 4
    return {
        id: i + 1,
        code: `P-${String(i + 1).padStart(4, "0")}`,
        name: NAMES[i % NAMES.length],
        sale_price: 400 + i * 130,
        uom_name: ["Pliego", "Kg", "Cara", "Unidad"][categoryId - 1],
        category: categoryId,
        product_type: isService ? "SERVICE" : "STORABLE",
        qty_available: i % 7 === 0 ? 0 : 120 + i * 35,
        is_favorite: i % 5 === 0,
        has_variants: i % 6 === 1,
        variants_count: 4,
        variant_axis_label: "Gramaje",
        min_variant_price: 480,
        is_dynamic_pricing: i % 8 === 3,
    }
})

const meta = {
    title: "Selectors/ProductGrid",
    component: ProductGrid,
    args: {
        products: PRODUCTS,
        categories: CATEGORIES,
        onProductClick: fn(),
        onToggleFavorite: fn(),
        isProductDisabled: (product: BaseProduct) => (product.qty_available ?? 1) <= 0 && product.product_type === "STORABLE",
        selectedProductIds: new Set([2, 3]),
    },
    decorators: [(Story) => <div className="w-full" style={{ height: 640 }}><Story /></div>],
} satisfies Meta<typeof ProductGrid>
export default meta
type Story = StoryObj<typeof meta>

export const Catalog: Story = {}
export const CalculatorCost: Story = { args: { priceLabel: "Costo", priceRenderer: (p: BaseProduct) => <span className="text-lg font-semibold tabular-nums">$ {Math.round(Number(p.sale_price) * 0.6)}</span> } }
export const Empty: Story = { args: { products: [] } }
