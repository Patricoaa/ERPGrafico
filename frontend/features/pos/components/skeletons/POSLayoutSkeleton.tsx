"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * POSHeaderSkeleton
 * Mimics the top bar of the POS
 */
export function POSHeaderSkeleton() {
    return (
        <div className="flex items-center justify-between py-1 px-1 mb-2 relative min-h-[56px] border-b pb-2">
            {/* Left: Terminal & Session Info */}
            <div className="flex items-center gap-4 flex-1">
                <div className="h-7 w-48 bg-muted animate-pulse rounded" />
                <div className="hidden sm:flex items-center gap-2">
                    <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                </div>
            </div>

            {/* Middle: Steps Header */}
            <div className="flex-1 flex justify-center px-4">
                <div className="w-full max-w-sm h-6 bg-muted animate-pulse rounded-full" />
            </div>

            {/* Right: Actions & Menu */}
            <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="hidden lg:flex items-center gap-1 mr-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-8 w-10 bg-muted animate-pulse rounded" />
                    ))}
                </div>
                <div className="h-9 w-24 bg-muted animate-pulse rounded" />
            </div>
        </div>
    )
}

/**
 * POSSearchSkeleton
 * Mimics search bar and category filters
 */
export function POSSearchSkeleton() {
    return (
        <div className="p-4 border-b bg-background/50 space-y-4">
            <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
            <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full shrink-0" />
                ))}
            </div>
        </div>
    )
}

/**
 * POSGridSkeleton
 * Mimics the product cards grid
 */
export function POSGridSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="flex flex-col overflow-hidden border-none shadow-none bg-muted/20">
                    <div className="aspect-square bg-muted animate-pulse" />
                    <CardContent className="p-3 flex flex-col gap-2">
                        <div className="flex justify-center gap-1">
                            <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                        <div className="h-4 w-2/3 bg-muted animate-pulse rounded mx-auto" />
                        <div className="h-6 w-20 bg-muted animate-pulse rounded mx-auto mt-1" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

/**
 * POSCartSkeleton
 * Mimics the right sidebar cart
 */
export function POSCartSkeleton() {
    return (
        <Card className="flex-1 flex flex-col overflow-hidden border bg-background/50 shadow-sm">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-4 pb-4 border-b bg-background/50 flex flex-col justify-center h-[88px] shrink-0 gap-2">
                    <div className="flex justify-between items-center">
                        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-hidden p-4 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-muted/50 last:border-0">
                            <div className="h-10 w-10 bg-muted animate-pulse rounded shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-full bg-muted animate-pulse rounded" />
                                <div className="h-2 w-1/2 bg-muted animate-pulse rounded" />
                            </div>
                            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-muted/20 border-t space-y-4">
                    {/* Metadata Summary Placeholder */}
                    <div className="h-20 w-full bg-muted/50 animate-pulse rounded-lg" />
                    
                    {/* Quick Sale Placeholder */}
                    <div className="h-12 w-full bg-muted animate-pulse rounded" />

                    {/* Totals */}
                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between">
                            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="flex justify-between">
                            <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                            <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                        </div>
                    </div>

                    {/* Final Action */}
                    <div className="h-16 w-full bg-muted animate-pulse rounded" />
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * POSLayoutSkeleton
 * The full combination of all skeletons
 */
export function POSLayoutSkeleton() {
    return (
        <div className="flex-1 p-4 pt-2 flex flex-col gap-2 overflow-hidden bg-background">
            <POSHeaderSkeleton />

            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Left Panel */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden bg-muted/10 border">
                        <POSSearchSkeleton />
                        <POSGridSkeleton count={12} />
                    </Card>
                </div>

                {/* Right Panel */}
                <div className="md:col-span-12 lg:col-span-5 flex flex-col min-h-0">
                    <POSCartSkeleton />
                </div>
            </div>
        </div>
    )
}
