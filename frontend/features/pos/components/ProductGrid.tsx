"use client"

// ProductGrid Component
// Grid display of products with availability indicators

import { Card, CardContent } from '@/components/ui/card'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { PricingUtils } from '@/lib/pricing'
import { useDeviceContext, MIN_TOUCH_TARGET } from '@/hooks/useDeviceContext'
import { Product, Category, StockLimits } from '@/types/pos'
import { Plus, Heart } from 'lucide-react'
import { memo } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { resolveMediaUrl } from '@/lib/api'

interface ProductGridProps {
    products: Product[]
    categories: Category[]
    limits: StockLimits
    onProductClick: (product: Product) => void
    onToggleFavorite?: (productId: number) => void
}

function ProductGridComponent({
    products,
    categories,
    limits,
    onProductClick,
    onToggleFavorite
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
        <div className={cn("grid gap-4", gridCols)}>
            {products.map(product => {
                const categoryId = typeof product.category === 'object'
                    ? product.category?.id
                    : product.category
                const catData = categories.find(c => Number(c.id) === Number(categoryId))
                const categoryIcon = (typeof product.category === 'object'
                    ? product.category?.icon
                    : catData?.icon) || null

                // Determine manufacturing sub-type for MANUFACTURABLE products
                const isManufacturable = product.product_type === 'MANUFACTURABLE'
                const mfgSubType = isManufacturable
                    ? (product.requires_advanced_manufacturing ? 'ADVANCED'
                        : product.mfg_auto_finalize ? 'EXPRESS' : 'SIMPLE')
                    : null

                // Determine if product is disabled based on sub-type
                const isStorableNoStock = product.product_type === 'STORABLE' && (product.qty_available || 0) <= 0
                let isMfgDisabled = false
                if (isManufacturable) {
                    if (mfgSubType === 'SIMPLE') {
                        // Simple: behaves like STORABLE — disabled when no stock
                        isMfgDisabled = (product.qty_available || 0) <= 0
                    } else if (mfgSubType === 'EXPRESS') {
                        // Express: without active BOM → always disabled; with BOM → disabled when 0 fabricable
                        if (!product.has_bom) {
                            isMfgDisabled = true
                        } else {
                            isMfgDisabled = product.manufacturable_quantity === 0
                        }
                    }
                    // Advanced: NEVER disabled
                }
                const isDisabled = isStorableNoStock || isMfgDisabled

                return (
                    <Card
                        key={product.id}
                        className={cn(
                            "group cursor-pointer hover:shadow-md transition-all border-2 overflow-hidden flex flex-col h-full",
                            isTouchPOS && "active:scale-95", // Feedback for touch
                            isDisabled && "opacity-50 grayscale cursor-not-allowed" // Removed pointer-events-none to allow favorite toggle
                        )}
                        onClick={() => !isDisabled && onProductClick(product)}
                    >
                        <div className={cn(
                            "aspect-square bg-muted/50 flex items-center justify-center relative",
                            // Larger image area for touch devices
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
                            
                            {/* Favorite Toggle */}
                            <button
                                className={cn(
                                    "absolute top-2 left-2 z-20 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:scale-110 active:scale-95 transition-all",
                                    product.is_favorite ? "text-destructive border-destructive/10 bg-destructive/10" : "text-muted-foreground"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleFavorite?.(product.id)
                                }}
                                title={product.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                            >
                                <Heart 
                                    className={cn(
                                        "h-4 w-4 transition-colors", 
                                        product.is_favorite ? "fill-current" : ""
                                    )} 
                                />
                            </button>

                            {/* Hover Indicator */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <span className="bg-primary text-primary-foreground shadow-lg text-[9px] font-bold uppercase px-2 py-1 rounded border border-primary/20 flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Agregar
                                </span>
                            </div>

                            {/* Stock/Availability Badge */}
                            {product.product_type === 'STORABLE' && (
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                    <div className={`h-2 w-2 rounded-full ${(limits[`prod_${product.id}`] ?? product.qty_available ?? 0) > 0
                                        ? 'bg-success'
                                        : 'bg-destructive'
                                        }`} />
                                    {limits[`prod_${product.id}`] ?? product.qty_available ?? 0}
                                </div>
                            )}

                            {/* MANUFACTURABLE badges differentiated by sub-type */}
                            {isManufacturable && mfgSubType === 'SIMPLE' && (
                                // Simple: same badge as STORABLE (stock-based)
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                    <div className={`h-2 w-2 rounded-full ${(limits[`prod_${product.id}`] ?? product.qty_available ?? 0) > 0
                                        ? 'bg-success'
                                        : 'bg-destructive'
                                        }`} />
                                    {limits[`prod_${product.id}`] ?? product.qty_available ?? 0}
                                </div>
                            )}

                            {isManufacturable && mfgSubType === 'EXPRESS' && (
                                // Express: without BOM → "Sin BOM" grey; with BOM → fabricable qty
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
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
                                // Advanced: with BOM → show fabricable qty; without BOM → "Disponible"
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
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
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                        <div className="h-2 w-2 rounded-full bg-success" />
                                        Disponible
                                    </div>
                                )}
                        </div>

                        <CardContent className={cn(
                            "p-2 text-center flex-1 flex flex-col justify-center gap-1",
                            isTouchPOS && "p-3"  // More padding for touch
                        )}>
                            <div className="flex flex-wrap justify-center gap-1 mb-1">
                                {product.internal_code && (
                                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/30 text-muted-foreground opacity-70">
                                        {product.internal_code}
                                    </span>
                                )}
                                {product.code && product.code !== product.internal_code && (
                                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/60 text-muted-foreground opacity-70">
                                        {product.code}
                                    </span>
                                )}
                            </div>
                            <div className={cn(
                                "font-bold line-clamp-2",
                                isTouchPOS ? "text-base" : "text-sm"  // Larger font for touch
                            )}>
                                {product.name}
                            </div>
                            <div className={cn(
                                "text-primary font-semibold mt-1",
                                isTouchPOS ? "text-lg" : "text-base"
                            )}>
                                {product.is_dynamic_pricing ? (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-warning/20 bg-warning/10 text-warning">
                                        Precio Dinámico
                                    </span>
                                ) : (
                                    <>
                                        {formatCurrency(PricingUtils.netToGross(Number(product.sale_price || 0)))}
                                        <span className="text-[10px] text-muted-foreground ml-1">c/IVA</span>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

// 🚀 Memoize to prevent unnecessary re-renders when products/limits haven't changed
export const ProductGrid = memo(ProductGridComponent, (prevProps, nextProps) => {
    return (
        prevProps.products === nextProps.products &&
        prevProps.limits === nextProps.limits &&
        prevProps.onProductClick === nextProps.onProductClick &&
        prevProps.onToggleFavorite === nextProps.onToggleFavorite
    )
})
