"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { SearchBar } from './SearchBar'
import { CategoryFilter } from './CategoryFilter'
import { ProductGrid } from './ProductGrid'
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
    priceRenderer
}: ProductSelectorProps) {
    return (
        <Card className="flex-1 flex flex-col overflow-hidden bg-muted/10 border">
            <div className="px-2 pt-2 pb-0 border-b bg-background/50 space-y-2 flex-shrink-0">
                <SearchBar 
                    value={searchTerm} 
                    onChange={onSearchChange} 
                    onEnter={onSearchEnter} 
                />
                <CategoryFilter 
                    categories={categories} 
                    selectedCategoryId={selectedCategoryId} 
                    onSelectCategory={onSelectCategory} 
                />
            </div>
            <div className="flex-1 px-2 pt-2 pb-0 min-h-0">
                <ProductGrid 
                    products={products} 
                    categories={categories} 
                    limits={limits} 
                    isProductDisabled={isProductDisabled} 
                    onProductClick={onProductClick} 
                    onToggleFavorite={onToggleFavorite} 
                    priceRenderer={priceRenderer}
                />
            </div>
        </Card>
    )
}
