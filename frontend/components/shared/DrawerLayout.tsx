"use client"

import React, { useState, type ReactNode } from "react"
import { type LucideIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TabBar, TabBarContent } from "./TabBar"
import { DrawerResizableRail } from "./DrawerResizableRail"

export interface DrawerLayoutTab {
    value: string
    label: string
    icon?: LucideIcon
    badge?: number | string
    hasErrors?: boolean
    disabled?: boolean
    hidden?: boolean
    /** Whether to force mounting in the DOM even when inactive */
    forceMount?: true
    /** Content of this tab */
    content: ReactNode
    /** Custom class for this tab's content wrapper */
    className?: string
    /** If true, removes the default padding (p-6) for this specific tab */
    noPadding?: boolean
    /** If true, hides the left rail while this tab is active */
    hideLeftRail?: boolean
    /** If true, hides the right rail while this tab is active */
    hideRightRail?: boolean
}

export interface DrawerLayoutProps {
    /** Tab definitions. When provided, tabs render at the top of the workspace aligned with the content */
    tabs?: DrawerLayoutTab[]
    /** Controlled active tab */
    activeTab?: string
    /** Default tab when uncontrolled */
    defaultTab?: string
    /** Tab change handler */
    onTabChange?: (tab: string) => void

    /** Direct content when not using tabs */
    children?: ReactNode

    /** Left rail (e.g. Stepper, category tree, navigation rail) */
    leftRail?: ReactNode
    /** Left rail width class (default: "w-48") */
    leftRailWidth?: string
    /** Whether left rail has border-r */
    leftRailBorder?: boolean
    /** If true, renders leftRail directly without wrapping it in an aside */
    leftRailRaw?: boolean

    /** Right rail (e.g. ActivitySidebar, task panel, specs) */
    rightRail?: ReactNode
    /** Right rail width class (default: "w-72") */
    rightRailWidth?: string
    /** Whether the right rail is collapsible */
    rightRailCollapsible?: boolean
    /** localStorage key to persist collapsed preference */
    rightRailStorageKey?: string
    /** Initial collapsed state when rightRailCollapsible is true */
    rightRailDefaultCollapsed?: boolean
    /** If true, renders rightRail directly without wrapping it in an aside */
    rightRailRaw?: boolean

    /** If true, removes the default padding (p-6) from the workspace/content area */
    noPadding?: boolean
    /** Additional classes for the workspace content container */
    contentClassName?: string
    /** Additional classes for the outermost layout container */
    className?: string
}

function getRailPaddingLeft(width?: string): string {
    if (!width) return "pl-48"
    if (width.includes("w-14")) return "pl-14"
    if (width.includes("w-16")) return "pl-16"
    if (width.includes("w-48")) return "pl-48"
    if (width.includes("w-56")) return "pl-56"
    if (width.includes("w-60")) return "pl-60"
    if (width.includes("w-64")) return "pl-64"
    if (width.includes("w-72")) return "pl-72"
    if (width.includes("w-80")) return "pl-80"
    if (width.includes("w-88")) return "pl-88"
    if (width.includes("w-96")) return "pl-96"
    return "pl-48"
}

export function DrawerLayout({
    tabs,
    activeTab: activeTabProp,
    defaultTab,
    onTabChange,
    children,
    leftRail,
    leftRailWidth = "w-48",
    leftRailBorder = true,
    leftRailRaw = false,
    rightRail,
    rightRailWidth = "w-72",
    rightRailCollapsible = false,
    rightRailStorageKey,
    rightRailDefaultCollapsed = false,
    rightRailRaw = false,
    noPadding = false,
    contentClassName,
    className,
}: DrawerLayoutProps) {
    // ── Internal Tab State ──────────────────────────────────────────────────
    const [internalTab, setInternalTab] = useState<string>(() => {
        if (defaultTab) return defaultTab
        if (tabs && tabs.length > 0) return tabs[0].value
        return ""
    })

    const currentTab = activeTabProp !== undefined ? activeTabProp : internalTab
    const handleTabChange = (nextTab: string) => {
        if (activeTabProp === undefined) {
            setInternalTab(nextTab)
        }
        onTabChange?.(nextTab)
    }

    const currentTabDef = tabs?.find((t) => t.value === currentTab)

    // Determine rail visibility based on current active tab rules
    const showLeftRail = !!leftRail && !currentTabDef?.hideLeftRail
    const showRightRail = !!rightRail && !currentTabDef?.hideRightRail

    const renderRailsAndWorkspace = () => (
        <div className="flex flex-1 min-h-0 h-full overflow-hidden bg-card">
            {/* ── 1. Left Rail (bajo las pestañas) ─────────────── */}
            {showLeftRail && (
                leftRailRaw ? (
                    leftRail
                ) : (
                    <aside
                        className={cn(
                            "shrink-0 h-full flex flex-col bg-card min-h-0 overflow-y-auto scrollbar-thin",
                            leftRailBorder && "border-r border-border/60",
                            leftRailWidth
                        )}
                    >
                        {leftRail}
                    </aside>
                )
            )}

            {/* ── 2. Workspace Central ─────── */}
            <main className="flex-1 min-w-0 h-full flex flex-col min-h-0 overflow-hidden bg-card">
                {tabs && tabs.length > 0 ? (
                    tabs.map((t) => (
                        <TabBarContent
                            key={t.value}
                            value={t.value}
                            forceMount={t.forceMount}
                            className={cn(
                                "data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin bg-card",
                                // Radix no aplica el atributo `hidden` a los paneles con
                                // `forceMount`, así que un panel inactivo quedaría visible
                                // dentro del workspace del tab activo. Lo ocultamos por CSS.
                                "data-[state=inactive]:hidden",
                                (t.noPadding ?? noPadding) ? "" : "p-6",
                                t.className,
                                contentClassName
                            )}
                        >
                            {t.content}
                        </TabBarContent>
                    ))
                ) : (
                    <div
                        className={cn(
                            "flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin bg-card",
                            noPadding ? "" : "p-6",
                            contentClassName
                        )}
                    >
                        {children}
                    </div>
                )}
            </main>

            {/* ── 3. Right Rail (bajo las pestañas) ────────────── */}
            {showRightRail && (
                rightRailRaw ? (
                    rightRail
                ) : rightRailCollapsible ? (
                    <DrawerResizableRail
                        side="right"
                        storageKey={rightRailStorageKey}
                        defaultCollapsed={rightRailDefaultCollapsed}
                        collapsedContent={
                            <div className="w-10 flex flex-col items-center gap-2 pt-3 bg-card h-full">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Actividad / Información"
                                    aria-label="Expandir panel lateral"
                                    className="flex h-7 w-7 items-center justify-center rounded p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        }
                        className="hidden lg:flex"
                        contentClassName="shadow-elevated overflow-y-auto scrollbar-thin"
                    >
                        {rightRail}
                    </DrawerResizableRail>
                ) : (
                    <aside
                        className={cn(
                            rightRailWidth,
                            "border-l border-border/60 flex flex-col hidden lg:flex bg-card shadow-elevated min-h-0 h-full overflow-y-auto scrollbar-thin"
                        )}
                    >
                        {rightRail}
                    </aside>
                )
            )}
        </div>
    )

    if (tabs && tabs.length > 0) {
        return (
            <div className={cn("flex flex-1 min-h-0 h-full overflow-hidden bg-card", className)}>
                <TabBar
                    items={tabs.map((t) => ({
                        value: t.value,
                        label: t.label,
                        icon: t.icon,
                        badge: t.badge,
                        hasErrors: t.hasErrors,
                        disabled: t.disabled,
                        hidden: t.hidden,
                    }))}
                    value={currentTab}
                    onValueChange={handleTabChange}
                    orientation="horizontal"
                    variant="underline"
                    className="flex-1 min-h-0 flex flex-col h-full bg-card"
                    headerClassName={cn(
                        "bg-card border-b border-border/60",
                        showLeftRail ? getRailPaddingLeft(leftRailWidth) : "px-6"
                    )}
                    contentClassName="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-card"
                >
                    {renderRailsAndWorkspace()}
                </TabBar>
            </div>
        )
    }

    return (
        <div className={cn("flex flex-1 min-h-0 h-full overflow-hidden bg-card", className)}>
            {renderRailsAndWorkspace()}
        </div>
    )
}
