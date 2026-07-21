"use client"

// ProductSelector/ProductGrid
// Grid display of products with availability indicators.
// Supports three density modes: rich (POS), compact (calculators), minimal (OT creation).
//
// Requires a parent container with explicit height (e.g. `flex-1 min-h-0`)
// to work correctly with VirtuosoGrid.

import { Button } from "@/components/ui/button"
import { Card } from '@/components/ui/card'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { PricingUtils } from '@/lib/pricing-utils'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { BaseProduct, ProductCategory } from '@/features/inventory'
import { Plus, Heart } from 'lucide-react'
import { memo } from 'react'
import { DynamicIcon, EmptyState } from '@/components/shared'
import { resolveMediaUrl } from '@/lib/media-url'
import { VirtuosoGrid } from 'react-virtuoso'

export type SharedStockLimits = Record<string, number | undefined>

/** Card density variant controlling information richness. */
export type CardDensity = 'rich' | 'compact' | 'minimal'

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
    /** IDs of selected products (in cart, calculator, etc). Shows CMY ribbon on each. */
    selectedProductIds?: Set<number>
    /** Controls information density on each card. 'rich' = full POS card, 'compact' = calculator, 'minimal' = OT picker. */
    density?: CardDensity
}

function ProductGridComponent({
    products,
    categories,
    limits = {},
    isProductDisabled = () => false,
    onProductClick,
    onToggleFavorite,
    priceRenderer,
    selectedProductIds,
    density = 'rich'
}: ProductGridProps) {
    const { isTouchPOS, isSmallScreen } = useDeviceContext()

    const isRich = density === 'rich'
    const isMinimal = density === 'minimal'

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

    // Adaptive grid columns based on device + density
    const gridCols = isMinimal
        ? (isTouchPOS ? "grid-cols-4" : isSmallScreen ? "grid-cols-3" : "grid-cols-3 lg:grid-cols-5")
        : density === 'compact'
            ? (isTouchPOS ? "grid-cols-4" : isSmallScreen ? "grid-cols-3" : "grid-cols-3 lg:grid-cols-4")
            : (isTouchPOS ? "grid-cols-3" : isSmallScreen ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")

    return (
        <VirtuosoGrid
            totalCount={products.length}
            listClassName={cn("grid gap-4 pb-2", gridCols)}
            style={{ height: '100%' }}
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

                const isDisabled = isProductDisabled(product)

                const isManufacturable = product.product_type === 'MANUFACTURABLE'
                const mfgSubType = isManufacturable
                    ? (product.requires_advanced_manufacturing ? 'ADVANCED'
                        : product.mfg_auto_finalize ? 'EXPRESS' : 'SIMPLE')
                    : null

                const qty = limits[`prod_${product.id}`] ?? product.qty_available ?? 0
                const hasQty = qty > 0

                return (
                    <Card
                        className={cn(
                            "group cursor-pointer transition-all border border-border/50 overflow-hidden flex flex-col h-full rounded-md bg-card shadow-card shadow-black/5",
                            isRich ? "p-2" : "p-1.5",
                            selectedProductIds?.has(product.id) && "ribbon-cmyk",
                            isTouchPOS && "active:scale-95",
                            isDisabled
                                ? "opacity-50 grayscale cursor-not-allowed"
                                : "hover:shadow-elevated"
                        )}
                        onClick={() => !isDisabled && onProductClick(product)}
                    >
                        {/* Image Area */}
                        <div className={cn(
                            "aspect-square bg-muted/20 rounded-sm flex items-center justify-center relative overflow-hidden border shadow-card",
                            isTouchPOS && "min-h-[120px]"
                        )}>
                            {product.image ? (
                                <Image src={resolveMediaUrl(product.image) ?? ''} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                                <DynamicIcon
                                    name={categoryIcon || "Package"}
                                    className="h-10 w-10 text-muted-foreground/30 group-hover:scale-110 transition-transform"
                                />
                            )}

                            {/* Hover Add Indicator — bottom-right corner, simplified */}
                            {!isDisabled && (
                                <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-floating flex items-center justify-center">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                </div>
                            )}

                            {/* Favorite Toggle — rich density only */}
                            {isRich && onToggleFavorite && (
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "absolute top-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 backdrop-blur-sm border shadow-floating hover:scale-110 active:scale-95 transition-all p-0",
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
                                </Button>
                            )}

                            {/* Availability Badge — hidden on minimal density */}
                            {!isMinimal && (
                                <div className="absolute top-2 right-2 flex flex-col gap-2 items-end z-20">
                                    {/* STORABLE */}
                                    {product.product_type === 'STORABLE' && (
                                        <AvailabilityBadge available={hasQty} label={String(qty)} />
                                    )}

                                    {/* SIMPLE Manufacturable */}
                                    {isManufacturable && mfgSubType === 'SIMPLE' && (
                                        <AvailabilityBadge available={hasQty} label={String(qty)} />
                                    )}

                                    {/* EXPRESS Manufacturable */}
                                    {isManufacturable && mfgSubType === 'EXPRESS' && (
                                        !product.has_bom ? (
                                            <BadgeChip label="Sin receta" />
                                        ) : (
                                            <AvailabilityBadge
                                                available={(product.manufacturable_quantity ?? 0) > 0}
                                                label={`${product.manufacturable_quantity ?? 0} fab.`}
                                            />
                                        )
                                    )}

                                    {/* ADVANCED Manufacturable */}
                                    {isManufacturable && mfgSubType === 'ADVANCED' && (
                                        product.has_bom ? (
                                            <AvailabilityBadge
                                                available={(product.manufacturable_quantity ?? 0) > 0}
                                                label={`${product.manufacturable_quantity ?? 0} fab.`}
                                            />
                                        ) : (
                                            <BadgeChip label="Sin receta" />
                                        )
                                    )}

                                    {/* SERVICE / SUBSCRIPTION / CONSUMABLE — always available */}
                                    {(product.product_type === 'SERVICE' ||
                                        product.product_type === 'SUBSCRIPTION' ||
                                        product.product_type === 'CONSUMABLE') && (
                                        <AvailabilityBadge available={true} label="Disponible" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Info Area */}
                        {!isMinimal ? (
                            <div className={cn(
                                "flex flex-col gap-0.5",
                                isRich ? "pt-3 pb-1 px-1" : "pt-2 pb-1 px-1",
                                isTouchPOS && isRich && "pt-4"
                            )}>
                                {/* Product Name — primary element */}
                                <div className={cn(
                                    "font-semibold text-left leading-tight",
                                    isRich ? "text-sm line-clamp-2" : "text-xs line-clamp-1",
                                    isTouchPOS && isRich && "text-base"
                                )}>
                                    {product.name}
                                </div>

                                {/* Price Section — own line below name */}
                                {(isRich || (priceRenderer && density === 'compact')) && (
                                    <div className="flex items-baseline gap-1.5 mt-0.5">
                                        {priceRenderer ? (
                                            priceRenderer(product)
                                        ) : product.is_dynamic_pricing ? (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-warning/20 bg-warning/10 text-warning">
                                                Dinámico
                                            </span>
                                        ) : (
                                            <>
                                                <span className={cn(
                                                    "font-medium text-foreground",
                                                    isTouchPOS && isRich ? "text-base" : "text-sm"
                                                )}>
                                                    {formatCurrency(PricingUtils.netToGross(Number(product.sale_price || 0)))}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground uppercase font-medium leading-none">
                                                    c/IVA
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Minimal: name only, tight */
                            <div className="pt-2 pb-1 px-1">
                                <div className="font-medium text-xs text-left leading-tight line-clamp-1">
                                    {product.name}
                                </div>
                            </div>
                        )}
                    </Card>
                )
            }}
        />
    )
}

/* ── Badge sub-components ────────────────────────────────────────── */

function AvailabilityBadge({ available, label }: { available: boolean; label: string }) {
    return (
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-floating border text-[10px] font-bold text-muted-foreground">
            <div className={cn("h-2 w-2 rounded-full", available ? "bg-success" : "bg-destructive")} />
            {label}
        </div>
    )
}

function BadgeChip({ label }: { label: string }) {
    return (
        <div className="flex items-center bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-floating border text-[10px] font-bold text-muted-foreground">
            {label}
        </div>
    )
}

export const ProductGrid = memo(ProductGridComponent, (prevProps, nextProps) => {
    return (
        prevProps.products === nextProps.products &&
        prevProps.limits === nextProps.limits &&
        prevProps.onProductClick === nextProps.onProductClick &&
        prevProps.onToggleFavorite === nextProps.onToggleFavorite &&
        prevProps.isProductDisabled === nextProps.isProductDisabled &&
        prevProps.priceRenderer === nextProps.priceRenderer &&
        prevProps.selectedProductIds === nextProps.selectedProductIds &&
        prevProps.density === nextProps.density
    )
})
