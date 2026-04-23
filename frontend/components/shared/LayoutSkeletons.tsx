"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "./TableSkeleton"

/**
 * Skeleton for the Page Header area in the top bar.
 */
export function PageHeaderSkeleton() {
    return (
        <div className="flex items-center gap-3 pointer-events-none min-w-0 animate-in fade-in duration-300">
            {/* Loading Indicator Placeholder */}
            <Skeleton className="h-8 w-8 shrink-0 bg-primary/5 border border-primary/5" />

            <div className="flex items-start gap-5">
                {/* Title and Description Placeholders */}
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2.5 w-48 opacity-40" />
                </div>

                {/* Status and Actions Placeholders */}
                <div className="flex items-center gap-2 mt-[-2px]">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-sm" />
                    <Skeleton className="h-8 w-8 rounded-sm" />
                </div>
            </div>
        </div>
    )
}

/**
 * Skeleton for the Page Navigation Tabs.
 */
export function PageTabsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="w-full border-b border-border/40 bg-muted/5">
            <div className="px-4">
                <nav className="flex items-center -mb-[1px]">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {Array.from({ length: count }).map((_, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent"
                            >
                                <Skeleton className="h-4 w-4 rounded-sm" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                </nav>
            </div>
        </div>
    )
}

/**
 * Skeleton for a standard DataTable Toolbar.
 */
export function ToolbarSkeleton({ hasSearch = true, actionButtons = 2 }: { hasSearch?: boolean, actionButtons?: number }) {
    return (
        <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex flex-1 items-center gap-2">
                {hasSearch && <Skeleton className="h-9 w-full max-w-[300px]" />}
                <Skeleton className="h-9 w-24" />
            </div>
            <div className="flex items-center gap-2">
                {Array.from({ length: actionButtons }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-24" />
                ))}
            </div>
        </div>
    )
}

/**
 * A high-level layout skeleton that mimics the standard ERP page structure.
 * Use this in loading.tsx files for consistent route transitions.
 */
export function PageLayoutSkeleton({ 
    hasTabs = false, 
    tabsCount = 3,
    hasToolbar = false,
    contentType = 'table',
    children
}: { 
    hasTabs?: boolean, 
    tabsCount?: number,
    hasToolbar?: boolean,
    contentType?: 'table' | 'card' | 'form' | 'custom',
    children?: React.ReactNode
}) {
    return (
        <div className="flex-1 flex flex-col min-w-0 animate-in fade-in duration-500">
            {/* We don't mock the PageHeader here because it's rendered in DashboardShell's top bar.
                However, in loading.tsx, DashboardShell will show nothing in the title area.
                If we want to mock the title area, we'd need to modify DashboardShell. */}
            
            {hasTabs && <PageTabsSkeleton count={tabsCount} />}

            <div className="p-4 space-y-4">
                {hasToolbar && <ToolbarSkeleton />}
                
                <div className="mt-4">
                    {children || (
                        <>
                            {contentType === 'table' && <TableSkeleton rows={8} columns={6} />}
                            {contentType === 'card' && (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <Card key={i} className="h-48">
                                            <div className="p-6 space-y-4">
                                                <Skeleton className="h-6 w-2/3" />
                                                <Skeleton className="h-20 w-full" />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {contentType === 'form' && (
                                <div className="max-w-2xl mx-auto space-y-8 p-6">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="space-y-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-10 w-full" />
                                        </div>
                                    ))}
                                    <div className="flex justify-end gap-2">
                                        <Skeleton className="h-10 w-24" />
                                        <Skeleton className="h-10 w-32" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * HubSkeleton: Specialized skeleton for the Command Center (Hub)
 * Mimics the vertical phases (Origen, Logística, Facturación, Tesorería)
 */
export function HubSkeleton() {
    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm p-4 gap-4 animate-in fade-in duration-500">
            <div className="flex flex-col items-center justify-center py-12 gap-4 border-b border-white/5">
                <Skeleton className="h-20 w-20 rounded-full border-2 border-primary/10" />
                <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-24 opacity-40" />
                </div>
            </div>
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-4">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-5 w-5 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-full opacity-60" />
                            <Skeleton className="h-3 w-2/3 opacity-40" />
                        </div>
                        <div className="pt-2 border-t border-border/20 flex justify-end">
                            <Skeleton className="h-8 w-24 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
