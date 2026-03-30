"use client"

// ProductGridSkeleton Component  
// Loading skeleton for product grid

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
        <div className={cn("grid gap-4", gridCols)}>
            {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i} className="flex flex-col overflow-hidden">
                    {/* Image skeleton */}
                    <div className={cn(
                        "aspect-square bg-muted animate-pulse",
                        isTouchPOS && "min-h-[120px]"
                    )} />

                    {/* Content skeleton */}
                    <CardContent className={cn(
                        "p-2 flex flex-col gap-2",
                        isTouchPOS && "p-3"
                    )}>
                        {/* Product name */}
                        <div className="h-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />

                        {/* Price */}
                        <div className="h-5 bg-muted animate-pulse rounded w-1/2 mx-auto mt-1" />

                        {/* Codes */}
                        <div className="flex gap-1 justify-center mt-1">
                            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
