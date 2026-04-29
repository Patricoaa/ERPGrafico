"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface CardSkeletonProps {
    count?: number
    className?: string
    variant?: 'grid' | 'list' | 'product' | 'compact'
    /** Optional grid configuration for 'grid' and 'product' variants */
    gridClassName?: string
}

/**
 * A standardized Card Skeleton for use in grid or list layouts.
 */
export function CardSkeleton({ 
    count = 3, 
    className,
    variant = 'grid',
    gridClassName
}: CardSkeletonProps) {
    // ─── Compact List Variant (Slimmer than standard list) ───────────────
    if (variant === 'compact') {
        return (
            <div className={cn("flex flex-col gap-2 animate-in fade-in duration-500", className)}>
                {Array.from({ length: count }).map((_, i) => (
                    <div 
                        key={`compact-item-${i}`} 
                        className="flex items-center p-3 rounded-md border border-border/40 bg-card/5 gap-3"
                    >
                        <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-2 w-1/2 opacity-60" />
                        </div>
                        <Skeleton className="h-4 w-12 ml-auto" />
                    </div>
                ))}
            </div>
        )
    }
    if (variant === 'list') {
        return (
            <div className={cn("flex flex-col gap-3 animate-in fade-in duration-500", className)}>
                {Array.from({ length: count }).map((_, i) => (
                    <div 
                        key={`list-item-${i}`} 
                        className="flex items-center justify-between p-4 rounded-md border border-border/40 bg-card/10 gap-6"
                    >
                        {/* ICON & TITLE AREA */}
                        <div className="flex items-center gap-4 min-w-[30%]">
                            <Skeleton className="h-12 w-12 rounded-md shrink-0" />
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        </div>

                        {/* CENTERED STATUS */}
                        <div className="flex-1 flex justify-center px-4">
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </div>

                        {/* RIGHT: TOTAL & ARROW */}
                        <div className="flex items-center gap-6">
                            <div className="text-right space-y-1 min-w-[100px]">
                                <Skeleton className="h-3 w-10 ml-auto" />
                                <Skeleton className="h-5 w-20 ml-auto" />
                            </div>
                            <Skeleton className="h-5 w-5 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // ─── Product/Media Variant (Image on top) ─────────────────────────────
    if (variant === 'product') {
        return (
            <div className={cn(
                "grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500", 
                gridClassName,
                className
            )}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={`product-${i}`} className="flex flex-col overflow-hidden rounded-md border border-border/40 bg-card/5">
                        <Skeleton className="aspect-square w-full rounded-none" />
                        <div className="p-3 flex flex-col gap-2">
                            <div className="flex justify-center gap-1">
                                <Skeleton className="h-3 w-10" />
                                <Skeleton className="h-3 w-10" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3 mx-auto" />
                            <Skeleton className="h-5 w-16 mx-auto mt-1" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // ─── Grid Variant (Standard Dashboard Card) ──────────────────────────
    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500", 
            gridClassName,
            className
        )}>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={`card-${i}`} 
                    className="p-6 rounded-md border border-border/40 bg-card/50 space-y-4"
                >
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2 opacity-60" />
                        </div>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                        <Skeleton className="h-8 w-24 rounded-sm" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    )
}
