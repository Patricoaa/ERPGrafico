"use client"

// ProductSelector/ProductGrid
// Virtualised grid of ProductCard. The card owns the anatomy; this file owns layout and lookups.
// Extracted from @/features/pos/components/ProductGrid (PR-2: ProductSelector migration).
//
// Requires a parent container with explicit height (e.g. `flex-1 min-h-0`)
// to work correctly with VirtuosoGrid.

import { memo, useMemo } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { cn } from '@/lib/utils'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { BaseProduct, ProductCategory } from '@/features/inventory'
import { EmptyState } from '@/components/shared'
import { ProductCard } from './ProductCard'

// Define StockLimits locally here since they are passed from POS but might not be present in other contexts
export type SharedStockLimits = Record<string, number | undefined>

export interface ProductGridProps {
    products: BaseProduct[]
    categories: ProductCategory[]
    /** Optional stock limits map, primarily used by POS to display specific branch inventory */
    limits?: SharedStockLimits
    /** Strategy to determine if a product is disabled (e.g., out of stock in POS). Defaults to always false. */
    isProductDisabled?: (product: BaseProduct) => boolean
    onProductClick: (product: BaseProduct) => void
    /** Provide this to show the favorite toggle button */
    onToggleFavorite?: (productId: number) => void
    /** Optional custom renderer for the price amount. Returning null hides the price block. Defaults to sale price c/IVA. */
    priceRenderer?: (product: BaseProduct) => React.ReactNode
    /** Caption above the price ("Venta c/IVA" by default, "Costo" in the calculator). */
    priceLabel?: string
    /** IDs of selected products (in cart, calculator, etc). Shows the CMYK ribbon + check on each. */
    selectedProductIds?: Set<number>
}

const NEVER_DISABLED = () => false
const NO_LIMITS: SharedStockLimits = {}

function ProductGridComponent({
    products,
    categories,
    limits = NO_LIMITS,
    isProductDisabled = NEVER_DISABLED,
    onProductClick,
    onToggleFavorite,
    priceRenderer,
    priceLabel,
    selectedProductIds
}: ProductGridProps) {
    const { isTouchPOS, isSmallScreen } = useDeviceContext()
    const categoriesById = useMemo(() => new Map(categories.map(c => [Number(c.id), c])), [categories])

    if (products.length === 0) {
        return (
            <div className="col-span-full py-12">
                <EmptyState
                    context="search"
                    variant="compact"
                    title="No se encontraron productos"
                    description="Pruebe con otros filtros o términos de búsqueda."
                />
            </div>
        )
    }

    // Adaptive grid columns based on device
    const gridCols = isTouchPOS
        ? "grid-cols-3"  // Tablet: 3 columns for better touch targets
        : isSmallScreen
            ? "grid-cols-2"  // Mobile: 2 columns
            : "grid-cols-2 lg:grid-cols-4"  // Desktop: 2-4 columns

    return (
        <VirtuosoGrid
            totalCount={products.length}
            listClassName={cn("grid gap-3 pb-2", gridCols)}
            style={{ height: '100%' }}
            overscan={400}
            itemContent={(index) => {
                const product = products[index]
                const categoryObject = typeof product.category === 'object' ? product.category : undefined
                const category = categoryObject ?? categoriesById.get(Number(product.category))

                return (
                    <ProductCard
                        product={product}
                        categoryName={category?.name ?? product.category_name}
                        categoryIcon={category?.icon}
                        limit={limits[`prod_${product.id}`]}
                        isDisabled={isProductDisabled(product)}
                        isSelected={selectedProductIds?.has(product.id) ?? false}
                        isTouch={isTouchPOS}
                        onProductClick={onProductClick}
                        onToggleFavorite={onToggleFavorite}
                        priceRenderer={priceRenderer}
                        priceLabel={priceLabel}
                    />
                )
            }}
        />
    )
}

// 🚀 Memoize to prevent unnecessary re-renders when products/limits haven't changed
export const ProductGrid = memo(ProductGridComponent, (prevProps, nextProps) => {
    return (
        prevProps.products === nextProps.products &&
        prevProps.categories === nextProps.categories &&
        prevProps.limits === nextProps.limits &&
        prevProps.onProductClick === nextProps.onProductClick &&
        prevProps.onToggleFavorite === nextProps.onToggleFavorite &&
        prevProps.isProductDisabled === nextProps.isProductDisabled &&
        prevProps.priceRenderer === nextProps.priceRenderer &&
        prevProps.priceLabel === nextProps.priceLabel &&
        prevProps.selectedProductIds === nextProps.selectedProductIds
    )
})
