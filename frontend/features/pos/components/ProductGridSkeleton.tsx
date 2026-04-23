"use client"

// ProductGridSkeleton Component  
// Loading skeleton for product grid

import { CardSkeleton } from '@/components/shared'
import { useDeviceContext } from '@/hooks/useDeviceContext'

export function ProductGridSkeleton() {
    const { isTouchPOS, isSmallScreen } = useDeviceContext()

    // Match ProductGrid's adaptive columns
    const gridCols = isTouchPOS
        ? "grid-cols-3"
        : isSmallScreen
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-4"

    return (
        <CardSkeleton 
            variant="product" 
            count={12} 
            gridClassName={gridCols} 
        />
    )
}
