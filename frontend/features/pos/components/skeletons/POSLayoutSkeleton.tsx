"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton } from "@/components/shared"

export function POSSearchSkeleton() {
    return (
        <div className="px-2 pt-1.5 pb-1.5 border-b bg-background/50 space-y-2">
            <Skeleton className="h-10 w-full rounded-sm" />
        </div>
    )
}

export function POSGridSkeleton({ count = 12 }: { count?: number }) {
    return (
        <CardSkeleton
            variant="product"
            count={count}
            gridClassName="grid-cols-2 lg:grid-cols-4 px-1.5 pt-1.5 pb-0"
        />
    )
}

export function POSCartItemsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 rounded-sm border border-border/40 bg-background">
                    <div className="flex justify-between items-start">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-2.5 w-24" />
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                </div>
            ))}
        </div>
    )
}

export function POSLayoutSkeleton() {
    return (
        <div role="status" aria-label="Cargando punto de venta" className="flex-1 p-3 pt-1.5 flex flex-col gap-1.5 overflow-hidden animate-in fade-in duration-500">
            <div className="flex items-center justify-between py-0.5 px-1 mb-1 relative min-h-[44px]">
                <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="h-6 w-48" />
                </div>

                <div className="flex-1 flex justify-center px-4" />

                <div className="flex items-center gap-2 flex-1 justify-end">
                    <div className="hidden lg:flex items-center gap-1 mr-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 min-w-[40px] rounded-sm" />
                        ))}
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <Skeleton className="h-10 w-20 rounded-sm" />
                </div>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
                <div className="md:col-span-12 lg:col-span-6 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden bg-card dot-grid-surface border py-1.5">
                        <POSSearchSkeleton />
                        <div className="flex-1 px-1.5 pt-1.5 pb-0">
                            <POSGridSkeleton count={12} />
                        </div>
                    </Card>
                </div>

                <div className="md:col-span-12 lg:col-span-6 flex flex-col min-h-0">
                    <Card className="py-2 flex-1 flex flex-col overflow-hidden border bg-card dot-grid-surface shadow-card rounded-md">
                        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                            <div className="px-4 py-1.5 border-b bg-muted/50 shrink-0">
                                <div className="flex justify-between items-center h-10">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-40" />
                                        <Skeleton className="h-2.5 w-28" />
                                    </div>
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto bg-muted/50">
                                <POSCartItemsSkeleton count={3} />
                            </div>

                            <div className="p-3 bg-muted/20 border-t space-y-3">
                                <Skeleton className="h-10 w-full rounded-sm" />

                                <div className="space-y-0.5">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-14" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                    <div className="flex justify-between pt-1.5 border-t">
                                        <Skeleton className="h-5 w-16" />
                                        <Skeleton className="h-5 w-24" />
                                    </div>
                                </div>

                                <Skeleton className="h-12 w-full rounded-sm" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
