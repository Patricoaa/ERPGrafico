"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

interface ActionDockProps {
    isVisible: boolean
    children: React.ReactNode
    className?: string
}

/**
 * ActionDock
 * A reusable floating taskbar for bottom-of-page actions, multi-selection summaries,
 * and contextual tools. Automatically adjusts its position when side panels are open.
 */
export function ActionDock({ isVisible, children, className }: ActionDockProps) {
    const [globalPanelStates, setGlobalPanelStates] = React.useState({ hub: false, inbox: false })

    // Track global panel states via body attributes (standard repo pattern)
    React.useEffect(() => {
        const updateStates = () => {
            setGlobalPanelStates({
                hub: document.body.hasAttribute('data-hub-open'),
                inbox: document.body.hasAttribute('data-inbox-open')
            })
        }
        
        updateStates()
        const observer = new MutationObserver(updateStates)
        observer.observe(document.body, { 
            attributes: true, 
            attributeFilter: ['data-hub-open', 'data-inbox-open'] 
        })
        
        return () => observer.disconnect()
    }, [])

    // Calculate shifting based on open panels to maintain visual centering
    // Each panel is roughly 320-400px. We shift by half the active panels' total width.
    const getPositionClass = () => {
        if (globalPanelStates.inbox && globalPanelStates.hub) return "left-[calc(50%-340px)] -translate-x-1/2"
        if (globalPanelStates.hub) return "left-[calc(50%-180px)] -translate-x-1/2"
        if (globalPanelStates.inbox) return "left-[calc(50%-160px)] -translate-x-1/2"
        return "left-1/2 -translate-x-1/2"
    }

    return isVisible && (
        <div
            className={cn(
                "fixed bottom-6 z-[100] bg-card border shadow-elevated rounded-lg px-6 py-2 flex items-center gap-8 transition-all duration-500 ease-[var(--ease-premium)]",
                "animate-in fade-in slide-in-from-bottom-4 ease-[cubic-bezier(0.34,1.56,0.64,1)] duration-500 fill-mode-both",
                getPositionClass(),
                className
            )}
        >
            {children}
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

ActionDock.Section = function ActionDockSection({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex items-center gap-2", className)}>{children}</div>
}

/**
 * Container for statistical data with an inner shadow and muted background.
 */
ActionDock.Stats = function ActionDockStats({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("flex items-center gap-8 bg-muted/40 px-8 py-2.5 rounded-full border border-border/40 shadow-inner", className)}>
            {children}
        </div>
    )
}

ActionDock.Stat = function ActionDockStat({ 
    label, 
    value, 
    colorClass = "text-foreground" 
}: { 
    label: React.ReactNode, 
    value: React.ReactNode, 
    colorClass?: string 
}) {
    return (
        <div className="flex flex-col border-r border-border/40 pr-8 last:border-0 justify-center">
            <div className="text-xs font-bold uppercase text-muted-foreground tracking-widest leading-none mb-1.5 whitespace-nowrap">{label}</div>
            <div className={cn("text-xs font-mono font-bold leading-none", colorClass)}>
                {value}
            </div>
        </div>
    )
}

/**
 * Container for action buttons, typically placed at the end of the dock.
 */
ActionDock.Actions = function ActionDockActions({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex items-center gap-2 border-l pl-6 py-1", className)}>{children}</div>
}

// ─── Bulk-action types & helpers (historically in BulkActionDock) ──────────────

export type BulkActionIntent = "default" | "destructive" | "warning" | "success" | "ghost"

export interface BulkAction<TData> {
    key: string
    label: React.ReactNode
    icon?: LucideIcon
    onClick: (items: TData[]) => void | Promise<void>
    intent?: BulkActionIntent
    disabled?: (items: TData[]) => boolean
    hidden?: (items: TData[]) => boolean
}

const intentClasses: Record<BulkActionIntent, string> = {
    default: "h-9 rounded-full px-6 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary shadow-floating transition-transform active:scale-95",
    destructive: "h-9 rounded-full px-4 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
    warning: "h-9 rounded-full px-4 text-xs text-warning hover:bg-warning/10 hover:text-warning",
    success: "h-9 rounded-full px-4 text-xs text-success hover:bg-success/10 hover:text-success",
    ghost: "h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground",
}

interface BulkActionButtonsProps<TData> {
    actions: BulkAction<TData>[]
    items: TData[]
    className?: string
}

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
                        variant="ghost"
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
