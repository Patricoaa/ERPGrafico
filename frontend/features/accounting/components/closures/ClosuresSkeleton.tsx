"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { EntityCard } from "@/components/shared/EntityCard"

export function ClosuresSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Toolbar Skeleton */}
            <div className="flex items-center justify-between gap-4 py-2">
                <div className="flex flex-1 items-center gap-3">
                    <Skeleton className="h-9 w-full max-w-[320px] rounded-md" />
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex h-9 items-center rounded-md border border-border/50 bg-background overflow-hidden">
                        <Skeleton className="h-full w-24 rounded-none border-r border-border/50" />
                        <Skeleton className="h-full w-24 rounded-none" />
                    </div>
                    <Skeleton className="h-9 w-40 rounded-md" />
                </div>
            </div>

            {/* Fiscal Year Cards Skeletons */}
            {Array.from({ length: 2 }).map((_, i) => (
                <EntityCard key={i} className="mb-6 overflow-hidden">
                    <div className="p-6 border-b border-border/40">
                        <div className="flex justify-between items-start">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-5 w-5 rounded-sm" />
                                    <Skeleton className="h-7 w-48" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20 rounded-full" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-32 rounded-md" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-muted/5">
                        <Skeleton className="h-3 w-28 mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 12 }).map((_, j) => (
                                <Card key={j} className="p-3 border border-border/40 shadow-none">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-2 w-12 opacity-50" />
                                        </div>
                                        <Skeleton className="h-5 w-5 rounded-full" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </EntityCard>
            ))}
        </div>
    )
}
