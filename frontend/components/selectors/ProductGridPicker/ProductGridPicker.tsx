"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SearchBar } from './SearchBar'
import { CategoryFilter } from './CategoryFilter'
import { ProductGrid } from './ProductGrid'
import { CategoryDropdown } from './CategoryDropdown'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { BaseProduct, ProductCategory } from '@/features/inventory'
import type { SharedStockLimits } from './ProductGrid'

export interface ProductGridPickerProps {
    products: BaseProduct[]
    categories: ProductCategory[]

    // Search Props
    searchTerm: string
    onSearchChange: (value: string) => void
    onSearchEnter?: () => void

    // Category Props
    selectedCategoryId: number | null
    onSelectCategory: (id: number | null) => void

    // Grid Props
    onProductClick: (product: BaseProduct) => void
    onToggleFavorite?: (productId: number) => void
    isProductDisabled?: (product: BaseProduct) => boolean
    limits?: SharedStockLimits
    priceRenderer?: (product: BaseProduct) => React.ReactNode
    /** Caption above the price ("Venta c/IVA" by default). */
    priceLabel?: string
    /** IDs of selected products (in cart, calculator, etc). Shows the CMYK ribbon + check on each. */
    selectedProductIds?: Set<number>
    /** Sin fondo, borde ni sombra: el picker se integra al layout como panel izquierdo transparente. */
    transparent?: boolean
}

export function ProductGridPicker({
    products,
    categories,
    searchTerm,
    onSearchChange,
    onSearchEnter,
    selectedCategoryId,
    onSelectCategory,
    onProductClick,
    onToggleFavorite,
    isProductDisabled,
    limits,
    priceRenderer,
    priceLabel,
    selectedProductIds,
    transparent = false
}: ProductGridPickerProps) {
    const { isDesktop } = useDeviceContext()

    return (
        <Card className={cn(
            "flex-1 flex flex-col py-1.5",
            // Transparente: sin recorte, para que el borde y el foco del buscador no se corten.
            transparent ? "min-h-0 overflow-visible border-0 bg-transparent shadow-none py-0" : "overflow-hidden bg-muted/10 border"
        )}>
            <div className={cn("space-y-2", transparent ? "pb-2" : "px-2 pt-1.5 pb-1.5 border-b")}>
                <SearchBar
                    value={searchTerm}
                    onChange={onSearchChange}
                    onEnter={onSearchEnter}
                    rightAction={isDesktop ? (
                        <CategoryDropdown
                            categories={categories}
                            selectedCategoryId={selectedCategoryId}
                            onSelectCategory={onSelectCategory}
                        />
                    ) : undefined}
                />
                {!isDesktop && (
                    <CategoryFilter
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        onSelectCategory={onSelectCategory}
                    />
                )}
            </div>
            <div className={cn("flex-1", transparent ? "min-h-0 overflow-hidden" : "px-1.5 pt-1.5 pb-0")}>
                <ProductGrid
                    products={products}
                    categories={categories}
                    limits={limits}
                    isProductDisabled={isProductDisabled}
                    onProductClick={onProductClick}
                    onToggleFavorite={onToggleFavorite}
                    priceRenderer={priceRenderer}
                    priceLabel={priceLabel}
                    selectedProductIds={selectedProductIds}
                />
            </div>
        </Card>
    )
}
