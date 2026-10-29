"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormSplitLayoutProps {
    /** Main form content or the Form component itself */
    children: React.ReactNode
    /** Sidebar content (usually Audit/Activity information) */
    sidebar?: React.ReactNode
    /** Whether to show the sidebar (typically only in edit mode) */
    showSidebar?: boolean
    /** Optional width override, defaults to w-72 */
    sidebarWidth?: string
    /** Additional classes for the form container */
    className?: string
    /**
     * When true the sidebar gets a collapse toggle (matching the OT Wizard pattern).
     * The collapsed state is managed internally; use `defaultCollapsed` to set the initial value.
     */
    collapsible?: boolean
    /** Initial collapsed state when `collapsible` is true. Defaults to false (expanded). */
    defaultCollapsed?: boolean
    /**
     * localStorage key used to persist the collapsed preference across sessions.
     * Omit to disable persistence.
     */
    collapseStorageKey?: string
}

/**
 * Handles the flexbox structure, internal scrolling, and the Audit Sidebar integration.
 *
 * When `collapsible` is true the sidebar gets a collapse/expand tab on its left edge
 * (same pattern as WizardRightSidebar). While collapsed only a narrow icon-rail is shown.
 */
export function FormSplitLayout({
    children,
    sidebar,
    showSidebar = false,
    sidebarWidth = "w-72",
    className,
    collapsible = false,
    defaultCollapsed = false,
    collapseStorageKey,
}: FormSplitLayoutProps) {
    // Always start expanded (false) to avoid SSR/client hydration mismatch.
    // The stored preference is applied after mount via useEffect.
    const [collapsed, setCollapsed] = useState(defaultCollapsed)

    useEffect(() => {
        if (!collapsible || !collapseStorageKey) return
        try {
            if (window.localStorage.getItem(collapseStorageKey) === '1') {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser preference after mount
                setCollapsed(true)
            }
        } catch {
            // localStorage unavailable (private mode); keep the default.
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
    }, [])

    const toggleCollapse = () => {
        setCollapsed((prev) => {
            const next = !prev
            if (collapseStorageKey) {
                try {
                    window.localStorage.setItem(collapseStorageKey, next ? '1' : '0')
                } catch {
                    // Ignore storage failures
                }
            }
            return next
        })
    }

    return (
        <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Main Form Area */}
            <div className={cn(
                "flex-1 flex flex-col overflow-y-auto scrollbar-thin min-h-0",
                className
            )}>
                {children}
            </div>

            {/* Audit/Activity Sidebar */}
            {showSidebar && sidebar && (
                collapsible ? (
                    /* ── Collapsible variant (OT-style) ──────────────────────────── */
                    <aside className="relative hidden lg:flex flex-col h-full shrink-0">
                        {/* Toggle tab — protrudes into the form area on the left edge */}
                        <button
                            type="button"
                            onClick={toggleCollapse}
                            className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-10 flex h-6 w-4 items-center justify-center rounded-l border border-r-0 border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            title={collapsed ? "Expandir actividad" : "Colapsar actividad"}
                            aria-label={collapsed ? "Expandir actividad" : "Colapsar actividad"}
                            aria-expanded={!collapsed}
                        >
                            {collapsed
                                ? <ChevronLeft className="h-3 w-3" aria-hidden />
                                : <ChevronRight className="h-3 w-3" aria-hidden />
                            }
                        </button>

                        {collapsed ? (
                            /* Icon rail when collapsed */
                            <div className="border-l w-10 flex flex-col items-center gap-2 pt-3 bg-background/95 h-full">
                                <button
                                    type="button"
                                    title="Actividad"
                                    aria-label="Actividad"
                                    onClick={toggleCollapse}
                                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            /* Full sidebar */
                            <div className={cn(
                                sidebarWidth,
                                "border-l flex flex-col bg-muted/40 shadow-elevated min-h-0 h-full overflow-y-auto scrollbar-thin"
                            )}>
                                {sidebar}
                            </div>
                        )}
                    </aside>
                ) : (
                    /* ── Static variant (existing behaviour) ─────────────────────── */
                    <aside
                        className={cn(
                            sidebarWidth,
                            "border-l flex flex-col hidden lg:flex bg-muted/40 shadow-elevated min-h-0 overflow-y-auto scrollbar-thin"
                        )}
                    >
                        {sidebar}
                    </aside>
                )
            )}
        </div>
    )
}
