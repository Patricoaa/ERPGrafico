"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface TableSkeletonProps {
    rows?: number
    columns?: number
    className?: string
}

/**
 * A standardized Table Skeleton for use in Suspense fallbacks.
 * Mimics the structure of a typical ERP DataTable.
 */
export function TableSkeleton({ 
    rows = 5, 
    columns = 5, 
    className 
}: TableSkeletonProps) {
    return (
        <div className={cn("w-full space-y-4 animate-in fade-in duration-500", className)}>
            {/* Header Placeholder */}
            <div className="flex items-center gap-4 pb-2 border-b border-border/40">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton 
                        key={`head-${i}`} 
                        className={cn(
                            "h-4", 
                            i === 0 ? "w-1/4" : "flex-1"
                        )} 
                    />
                ))}
            </div>

            {/* Row Placeholders */}
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={`row-${i}`} className="flex items-center gap-4 py-3 border-b border-border/10">
                        {Array.from({ length: columns }).map((_, j) => (
                            <Skeleton 
                                key={`cell-${i}-${j}`} 
                                className={cn(
                                    "h-5",
                                    j === 0 ? "w-1/3" : "flex-1"
                                )} 
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
