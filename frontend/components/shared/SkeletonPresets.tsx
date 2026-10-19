"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Skeleton Presets — Common loading patterns for use with SkeletonShell
 * 
 * Usage:
 *   <SkeletonShell isLoading={isLoading} ariaLabel="Cargando formulario...">
 *     <SkeletonPresets.Form fields={6} />
 *   </SkeletonShell>
 * 
 * These are layout-only components — they match the real component's structure
 * so the CSS shimmer in SkeletonShell works correctly.
 */

// ─── Entity Card (for lists, grids) ──────────────────────────────────────────
export function EntityCardSkeleton({ variant = "default", className }: { variant?: "default" | "compact"; className?: string }) {
    const isCompact = variant === "compact"
    return (
        <div className={cn("animate-pulse space-y-3 p-4", className)}>
            <div className="flex items-start gap-4">
                <Skeleton className={cn("rounded-md flex-shrink-0 bg-muted/50", isCompact ? "h-10 w-10" : "h-12 w-12")} />
                <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    {isCompact ? null : <Skeleton className="h-3 w-1/3" />}
                </div>
            </div>
            {isCompact ? null : (
                <div className="flex items-center gap-2 pt-2 border-t">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-2 w-10" />
                </div>
            )}
        </div>
    )
}

// ─── Data Row (for tables) ──────────────────────────────────────────────────
export function DataRowSkeleton({ columns = 5, className }: { columns?: number; className?: string }) {
    return (
        <div className={cn("animate-pulse", className)}>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }, (_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                ))}
            </div>
        </div>
    )
}

// ─── Form Fields (for settings forms, drawers) ───────────────────────────────
export function FormFieldsSkeleton({ fields = 4, columns = 2, gap = 6, className }: { fields?: number; columns?: 1 | 2 | 3; gap?: 4 | 6 | 8; className?: string }) {
    const gapClass = `gap-${gap}`
    const colsClass = columns === 1 ? "grid-cols-1" : columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
    
    return (
        <div className={cn("animate-pulse space-y-6", className)}>
            <div className={cn("grid grid-cols-1", colsClass, gapClass)}>
                {Array.from({ length: fields }, (_, i) => (
                    <div key={i} className="space-y-1.5">
                        <Skeleton className="h-4 w-24" /> {/* label */}
                        <Skeleton className="h-10 w-full" /> {/* input */}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
export function StatCardSkeleton({ variant = "default", className }: { variant?: "default" | "compact"; className?: string }) {
    const isCompact = variant === "compact"
    return (
        <div className={cn("animate-pulse rounded-md border p-4 space-y-3 bg-card", className)}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className={cn("h-8 w-1/2", isCompact && "h-6")} />
            <Skeleton className="h-3 w-3/4" />
        </div>
    )
}

// ─── Card Content ────────────────────────────────────────────────────────────
export function CardContentSkeleton({ sections = 1, fieldsPerSection = 4, className }: { sections?: number; fieldsPerSection?: number; className?: string }) {
    return (
        <div className={cn("animate-pulse space-y-6 p-6", className)}>
            {Array.from({ length: sections }, (_, s) => (
                <div key={s} className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-24" /> {/* section title */}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: fieldsPerSection }, (_, i) => (
                            <div key={i} className="space-y-1.5">
                                <Skeleton className="h-4 w-24" /> {/* label */}
                                <Skeleton className="h-10 w-full" /> {/* input */}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Page Header ─────────────────────────────────────────────────────────────
export function PageHeaderPreset({ hasActions = true, className }: { hasActions?: boolean; className?: string }) {
    return (
        <div className={cn("animate-pulse flex flex-col gap-4", className)}>
            <div className="flex items_center justify-between">
                <div className="space-y-1">
                    <Skeleton className="h-6 w-48" /> {/* title */}
                    <Skeleton className="h-4 w-64" /> {/* description */}
                </div>
                {hasActions && <Skeleton className="h-10 w-32" />} {/* action button */}
            </div>
        </div>
    )
}

// ─── Table with Toolbar ──────────────────────────────────────────────────────
export function TableWithToolbarSkeleton({ rows = 5, columns = 6, className }: { rows?: number; columns?: number; className?: string }) {
    return (
        <div className={cn("animate-pulse space-y-4", className)}>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-40" /> {/* create button */}
            </div>
            {/* Search */}
            <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
            </div>
            {/* Table */}
            <div className="rounded-md border overflow-hidden">
                <div className="grid gap-4 p-4 border-b" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                    {Array.from({ length: columns }, (_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                    ))}
                </div>
                <div className="divide-y">
                    {Array.from({ length: rows }, (_, r) => (
                        <div key={r} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                            {Array.from({ length: columns }, (_, i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {/* Pagination */}
            <Skeleton className="h-10 w-48 mx-auto" />
        </div>
    )
}

// ─── Modal/Drawer Content ────────────────────────────────────────────────────
export function ModalContentSkeleton({ fields = 6, className }: { fields?: number; className?: string }) {
    return (
        <div className={cn("animate-pulse space-y-6 p-6", className)}>
            <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" /> {/* title */}
                <Skeleton className="h-10 w-10 rounded-full" /> {/* close button */}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: fields }, (_, i) => (
                    <div key={i} className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
    )
}

// ─── List Item ───────────────────────────────────────────────────────────────
export function ListItemSkeleton({ hasIcon = true, lines = 2, className }: { hasIcon?: boolean; lines?: 1 | 2 | 3; className?: string }) {
    return (
        <div className={cn("animate-pulse flex items-center gap-4 py-3", className)}>
            {hasIcon && <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />}
            <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                {lines >= 2 && <Skeleton className="h-3 w-1/2" />}
                {lines >= 3 && <Skeleton className="h-3 w-1/3" />}
            </div>
            <Skeleton className="h-6 w-16" /> {/* trailing */}
        </div>
    )
}

// ─── Chart ───────────────────────────────────────────────────────────────────
export function ChartSkeleton({ height = 200, className }: { height?: number; className?: string }) {
    return (
        <div className={cn("animate-pulse rounded-md border bg-card p-4", className)} style={{ height }}>
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-full w-full" />
        </div>
    )
}

// ─── Export all presets as namespace ──────────────────────────────────────────
export const SkeletonPresets = {
    EntityCard: EntityCardSkeleton,
    DataRow: DataRowSkeleton,
    FormFields: FormFieldsSkeleton,
    StatCard: StatCardSkeleton,
    CardContent: CardContentSkeleton,
    PageHeader: PageHeaderPreset,
    TableWithToolbar: TableWithToolbarSkeleton,
    ModalContent: ModalContentSkeleton,
    ListItem: ListItemSkeleton,
    Chart: ChartSkeleton,
}