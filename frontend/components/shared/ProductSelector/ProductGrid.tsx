"use client"

// ProductSelector/ProductGrid
// Grid display of products with availability indicators
// Extracted from @/features/pos/components/ProductGrid (PR-2: ProductSelector migration).
// 
// Requires a parent container with explicit height (e.g. `flex-1 min-h-0`) 
// to work correctly with VirtuosoGrid.

import { Card } from '@/components/ui/card'

import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { BaseProduct, ProductCategory } from '@/features/inventory/types'
import { Plus, Heart } from 'lucide-react'
import { memo } from 'react'
import { DynamicIcon, EmptyState } from '@/components/shared'
import { resolveMediaUrl } from '@/lib/api'
import { VirtuosoGrid } from 'react-virtuoso'

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
    /** Optional custom renderer for the price section. If not provided, defaults to displaying sale_price */
    priceRenderer?: (product: BaseProduct) => React.ReactNode
}

function ProductGridComponent({
    products,
    categories,
    limits = {},
    isProductDisabled = () => false,
    onProductClick,
    onToggleFavorite,
    priceRenderer
}: ProductGridProps) {
    const { isTouchPOS, isSmallScreen } = useDeviceContext()

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
            listClassName={cn("grid gap-4", gridCols)}
            style={{ height: '105%' }}
            overscan={400}
            itemContent={(index) => {
                const product = products[index]
                const categoryId = typeof product.category === 'object'
                    ? product.category?.id
                    : product.category
                const catData = categories.find(c => Number(c.id) === Number(categoryId))
                const categoryIcon = (typeof product.category === 'object'
                    ? product.category?.icon
                    : catData?.icon) || null

                // Uses the injected strategy to determine if disabled
                const isDisabled = isProductDisabled(product)

                // Used only for visual badges
                const isManufacturable = product.product_type === 'MANUFACTURABLE'
                const mfgSubType = isManufacturable
                    ? (product.requires_advanced_manufacturing ? 'ADVANCED'
                        : product.mfg_auto_finalize ? 'EXPRESS' : 'SIMPLE')
                    : null

                return (
                    <Card
                        className={cn(
                            "group cursor-pointer hover:shadow-md transition-all border overflow-hidden flex flex-col h-full rounded-md p-2 bg-card",
                            isTouchPOS && "active:scale-95",
                            isDisabled && "opacity-50 grayscale cursor-not-allowed"
                        )}
                        onClick={() => !isDisabled && onProductClick(product)}
                    >
                        <div className={cn(
                            "aspect-square bg-muted/20 rounded-sm flex items-center justify-center relative overflow-hidden border shadow-sm",
                            isTouchPOS && "min-h-[120px]"
                        )}>
                            {product.image ? (
                                <img src={resolveMediaUrl(product.image)!} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                                <DynamicIcon
                                    name={categoryIcon || "Package"}
                                    className="h-10 w-10 text-muted-foreground/30 group-hover:scale-110 transition-transform"
                                />
                            )}

                            {/* Hover Indicator (Centered Large Icon) */}
                            {!isDisabled && (
                                <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transform scale-50 group-hover:scale-100 transition-transform duration-300 ease-out">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                </div>
                            )}

                            {/* Left side Favorite Badge */}
                            {onToggleFavorite && (
                                <button
                                    className={cn(
                                        "absolute top-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 backdrop-blur-sm border shadow-sm hover:scale-110 active:scale-95 transition-all",
                                        product.is_favorite ? "text-destructive border-destructive/10 bg-destructive/10" : "text-muted-foreground"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleFavorite(product.id)
                                    }}
                                    title={product.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                                >
                                    <Heart
                                        className={cn(
                                            "h-3.5 w-3.5 transition-colors",
                                            product.is_favorite ? "fill-current" : ""
                                        )}
                                    />
                                </button>
                            )}

                            {/* Right side badges (Availability) */}
                            <div className="absolute top-2 right-2 flex flex-col gap-2 items-end z-20">

                                {/* Stock/Availability Badge */}
                                {product.product_type === 'STORABLE' && (
                                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-bold text-muted-foreground">
                                        <div className={`h-2 w-2 rounded-full ${(limits[`prod_${product.id}`] ?? product.qty_available ?? 0) > 0 ? 'bg-success' : 'bg-destructive'}`} />
                                        {limits[`prod_${product.id}`] ?? product.qty_available ?? 0}
                                    </div>
                                )}

                                {/* MANUFACTURABLE badges */}
                                {isManufacturable && mfgSubType === 'SIMPLE' && (
                                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-bold text-muted-foreground">
                                        <div className={`h-2 w-2 rounded-full ${(limits[`prod_${product.id}`] ?? product.qty_available ?? 0) > 0 ? 'bg-success' : 'bg-destructive'}`} />
                                        {limits[`prod_${product.id}`] ?? product.qty_available ?? 0}
                                    </div>
                                )}

                                {isManufacturable && mfgSubType === 'EXPRESS' && (
                                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-bold text-muted-foreground">
                                        {!product.has_bom ? (
                                            <>
                                                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                                                Sin LdM
                                            </>
                                        ) : (
                                            <>
                                                <div className={`h-2 w-2 rounded-full ${(product.manufacturable_quantity ?? 0) > 0 ? 'bg-primary' : 'bg-destructive'}`} />
                                                {`${product.manufacturable_quantity ?? 0} fab.`}
                                            </>
                                        )}
                                    </div>
                                )}

                                {isManufacturable && mfgSubType === 'ADVANCED' && (
                                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-bold text-muted-foreground">
                                        {product.has_bom ? (
                                            <>
                                                <div className={`h-2 w-2 rounded-full ${(product.manufacturable_quantity ?? 0) > 0 ? 'bg-primary' : 'bg-warning'}`} />
                                                {`${product.manufacturable_quantity ?? 0} fab.`}
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-2 w-2 rounded-full bg-primary" />
                                                Disponible
                                            </>
                                        )}
                                    </div>
                                )}

                                {(product.product_type === 'SERVICE' ||
                                    product.product_type === 'SUBSCRIPTION' ||
                                    product.product_type === 'CONSUMABLE') && (
                                        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm border text-[10px] font-bold text-muted-foreground">
                                            <div className="h-2 w-2 rounded-full bg-success" />
                                            Disponible
                                        </div>
                                    )}
                            </div>
                        </div>

                        <div className={cn(
                            "pt-3 pb-1 px-1 flex items-start justify-between gap-3",
                            isTouchPOS && "pt-4"
                        )}>
                            <div className={cn(
                                "font-bold line-clamp-2 text-left flex-1 leading-tight",
                                isTouchPOS ? "text-base" : "text-sm"
                            )}>
                                {product.name}
                            </div>
                            <div className={cn(
                                "text-primary font-black text-right shrink-0",
                                isTouchPOS ? "text-lg" : "text-base"
                            )}>
                                {priceRenderer ? priceRenderer(product) : (
                                    product.is_dynamic_pricing ? (
                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-warning/20 bg-warning/10 text-warning">
                                            Dinámico
                                        </span>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <span>{formatCurrency(PricingUtils.netToGross(Number(product.sale_price || 0)))}</span>
                                            <span className="text-[9px] text-muted-foreground uppercase font-semibold leading-none mt-0.5">c/IVA</span>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </Card>
                )
            }}
        />
    )
}

// 🚀 Memoize to prevent unnecessary re-renders when products/limits haven't changed
export const ProductGrid = memo(ProductGridComponent, (prevProps, nextProps) => {
    return (
        prevProps.products === nextProps.products &&
        prevProps.limits === nextProps.limits &&
        prevProps.onProductClick === nextProps.onProductClick &&
        prevProps.onToggleFavorite === nextProps.onToggleFavorite &&
        prevProps.isProductDisabled === nextProps.isProductDisabled &&
        prevProps.priceRenderer === nextProps.priceRenderer
    )
})
