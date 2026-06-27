"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { SearchBar } from './SearchBar'
import { CategoryFilter } from './CategoryFilter'
import { ProductGrid } from './ProductGrid'
import { CategoryDropdown } from './CategoryDropdown'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { BaseProduct, ProductCategory } from '@/features/inventory/types'
import type { SharedStockLimits } from './ProductGrid'

export interface ProductSelectorProps {
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
    /** IDs of selected products (in cart, calculator, etc). Shows CMY ribbon on each. */
    selectedProductIds?: Set<number>
}

export function ProductSelector({
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
    selectedProductIds
}: ProductSelectorProps) {
    const { isDesktop } = useDeviceContext()

    return (
        <Card className="flex-1 flex flex-col overflow-hidden bg-muted/10 border py-1.5">
            <div className="px-2 pt-1.5 pb-1.5 border-b space-y-2">
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
            <div className="flex-1 px-1.5 pt-1.5 pb-0">
                <ProductGrid
                    products={products}
                    categories={categories}
                    limits={limits}
                    isProductDisabled={isProductDisabled}
                    onProductClick={onProductClick}
                    onToggleFavorite={onToggleFavorite}
                    priceRenderer={priceRenderer}
                    selectedProductIds={selectedProductIds}
                />
            </div>
        </Card>
    )
}
