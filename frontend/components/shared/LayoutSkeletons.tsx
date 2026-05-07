"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "./TableSkeleton"
import { FormSkeleton } from "./FormSkeleton"

/**
 * Skeleton for the Page Header area in the top bar.
 * Sub-component — used inside DashboardShell, not a standalone status region.
 */
export function PageHeaderSkeleton() {
    return (
        <div className="flex items-center gap-3 pointer-events-none min-w-0 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded-sm opacity-20" />
                <Skeleton className="h-4 w-32 opacity-20" />
            </div>
        </div>
    )
}

/**
 * Skeleton for the Page Navigation Tabs.
 * Sub-component — used inside PageLayoutSkeleton, not a standalone status region.
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
 * Sub-component — used inside PageLayoutSkeleton, not a standalone status region.
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
 * High-level layout skeleton mimicking the standard ERP page structure.
 * Use in loading.tsx files for consistent route transitions.
 */
export function PageLayoutSkeleton({
    hasTabs = false,
    tabsCount = 3,
    hasToolbar = false,
    contentType = 'table',
    children
}: {
    hasTabs?: boolean
    tabsCount?: number
    hasToolbar?: boolean
    contentType?: 'table' | 'card' | 'form' | 'custom'
    children?: React.ReactNode
}) {
    return (
        <div
            role="status"
            aria-label="Cargando página"
            className="flex-1 flex flex-col min-w-0 animate-in fade-in duration-500"
        >
            {hasTabs && <PageTabsSkeleton count={tabsCount} />}

            <div className="p-4 space-y-4">
                {hasToolbar && <ToolbarSkeleton />}

                <div className="mt-4">
                    {children || (
                        <>
                            {contentType === 'table' && (
                                <TableSkeleton rows={8} columns={6} />
                            )}
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
                                <div className="max-w-2xl mx-auto">
                                    <FormSkeleton fields={4} cards={1} />
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
 * Specialized skeleton for the Command Center (Hub).
 * Mimics the vertical phase cards (Origen, Logística, Facturación, Tesorería).
 */
export function HubSkeleton({ phases = 4 }: { phases?: number } = {}) {
    return (
        <div
            role="status"
            aria-label="Cargando panel de control"
            className="flex flex-col h-full bg-background/50 backdrop-blur-sm p-4 gap-4 animate-in fade-in duration-500"
        >
            <div className="flex flex-col items-center justify-center py-12 gap-4 border-b border-white/5">
                <Skeleton className="h-20 w-20 rounded-full border-2 border-primary/10" />
                <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-24 opacity-40" />
                </div>
            </div>
            <div className="space-y-4">
                {Array.from({ length: phases }).map((_, i) => (
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

/**
 * Full app-shell skeleton shown during the root route transition.
 * Mimics the sidebar + topbar + content area layout.
 * Use exclusively in app/loading.tsx.
 */
export function AppShellSkeleton() {
    return (
        <div
            role="status"
            aria-label="Cargando aplicación"
            className="flex h-screen w-full"
        >
            <div className="hidden md:flex flex-col w-64 border-r p-4 gap-4 shrink-0">
                <Skeleton className="h-8 w-36" />
                <div className="space-y-2 mt-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                <div className="h-14 border-b px-6 flex items-center justify-between shrink-0">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex-1 p-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-9 w-28" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-28" />
                        ))}
                    </div>
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        </div>
    )
}
