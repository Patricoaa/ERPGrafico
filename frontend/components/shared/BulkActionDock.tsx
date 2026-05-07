"use client"

import * as React from "react"
import { X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ActionDock } from "./ActionDock"

/**
 * Visual intent for a bulk action button.
 * Maps to a curated palette inside the dock so all tables look consistent.
 */
export type BulkActionIntent = "default" | "destructive" | "warning" | "success" | "ghost"

/**
 * Declarative description of a bulk action button rendered inside the dock.
 *
 * The 80% case uses this directly via `DataTable.bulkActions`. For custom
 * layouts (stats, dropdowns, segmented controls) use `DataTable.bulkDock`
 * with `BulkActionDock` + `BulkActionButtons` as primitives.
 */
export interface BulkAction<TData> {
    key: string
    label: React.ReactNode
    icon?: LucideIcon
    onClick: (items: TData[]) => void | Promise<void>
    intent?: BulkActionIntent
    disabled?: (items: TData[]) => boolean
    hidden?: (items: TData[]) => boolean
}

interface BulkActionDockProps {
    selectedCount: number
    onClear?: () => void
    children?: React.ReactNode
    selectionLabel?: (count: number) => React.ReactNode
    className?: string
}

const intentClasses: Record<BulkActionIntent, string> = {
    default: "h-9 rounded-full px-6 text-xs font-bold shadow-sm transition-transform active:scale-95",
    destructive: "h-9 rounded-full px-4 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
    warning: "h-9 rounded-full px-4 text-xs text-warning hover:bg-warning/10 hover:text-warning",
    success: "h-9 rounded-full px-4 text-xs text-success hover:bg-success/10 hover:text-success",
    ghost: "h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted",
}

const defaultSelectionLabel = (count: number) =>
    `${count} ${count === 1 ? "seleccionado" : "seleccionados"}`

/**
 * Floating dock for table bulk actions.
 *
 * Wraps `ActionDock` with the table-specific scaffolding:
 *   - "N seleccionados" pill on the left
 *   - Optional "Limpiar" button on the right
 *
 * Compose the middle slot with `ActionDock.Stats`, `ActionDock.Actions`,
 * or `BulkActionButtons` (declarative shortcut).
 */
export function BulkActionDock({
    selectedCount,
    onClear,
    children,
    selectionLabel = defaultSelectionLabel,
    className,
}: BulkActionDockProps) {
    return (
        <ActionDock isVisible={selectedCount > 0} className={className}>
            <div className="flex items-center gap-2 pr-6 border-r border-border/40">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground whitespace-nowrap">
                    {selectionLabel(selectedCount)}
                </span>
            </div>

            {children}

            {onClear && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted"
                >
                    <X className="h-3 w-3 mr-1.5" />
                    Limpiar
                </Button>
            )}
        </ActionDock>
    )
}

interface BulkActionButtonsProps<TData> {
    actions: BulkAction<TData>[]
    items: TData[]
    className?: string
}

/**
 * Renders a list of `BulkAction` definitions as styled buttons inside an
 * `ActionDock.Actions` wrapper. Used by `DataTable.bulkActions` and reusable
 * inside any custom `bulkDock` render prop.
 */
export function BulkActionButtons<TData>({
    actions,
    items,
    className,
}: BulkActionButtonsProps<TData>) {
    const visible = actions.filter(a => !a.hidden?.(items))
    if (visible.length === 0) return null

    return (
        <ActionDock.Actions className={className}>
            {visible.map(action => {
                const Icon = action.icon
                const intent = action.intent ?? "ghost"
                const isDisabled = action.disabled?.(items) ?? false
                return (
                    <Button
                        key={action.key}
                        variant={intent === "default" ? "default" : "ghost"}
                        size="sm"
                        disabled={isDisabled}
                        onClick={() => action.onClick(items)}
                        className={cn(intentClasses[intent], "disabled:opacity-30")}
                    >
                        {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
                        {action.label}
                    </Button>
                )
            })}
        </ActionDock.Actions>
    )
}
