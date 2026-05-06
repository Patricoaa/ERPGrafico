"use client"

import React from "react"
import Link from "next/link"
import { ChevronsUpDown, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

interface HeaderNavDropdownsProps {
    navigation: NavigationConfig
    /** Icon rendered before the primary dropdown title */
    iconName?: string
}

/**
 * Railway-style dropdown navigation for the DashboardShell top bar.
 * Replaces horizontal PageTabs with:
 *   [Icon] [Active View ▾]  ·  [Active Sub-view ▾]  ⚙ (config)
 */
export function HeaderNavDropdowns({ navigation, iconName }: HeaderNavDropdownsProps) {
    const { tabs, activeValue, subActiveValue, configHref, breadcrumbs } = navigation

    // Separate config tab from regular tabs
    const regularTabs = (tabs || []).filter(t => t.value !== "config")
    const activeTab = (tabs || []).find(t => t.value === activeValue)
    const activeSubTabs = activeTab?.subTabs
    const activeSubTab = activeSubTabs?.find(s => s.value === subActiveValue)

    return (
        <div className="flex items-center gap-0 min-w-0">
            {/* ── Icon ── */}
            {iconName && (
                <DynamicIcon
                    name={iconName}
                    className="h-4 w-4 text-primary/70 shrink-0 mr-2"
                />
            )}

            {/* ── Module Name (Root) ── */}
            {navigation.moduleName && (
                <div className="flex items-center">
                    {navigation.moduleHref ? (
                        <Link 
                            href={navigation.moduleHref}
                            className="text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {navigation.moduleName}
                        </Link>
                    ) : (
                        <span className="text-sm font-semibold tracking-tight text-muted-foreground">
                            {navigation.moduleName}
                        </span>
                    )}
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>
                </div>
            )}

            {/* ── Primary Dropdown: View Selector ── */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 -ml-2 rounded-md transition-colors",
                        "text-sm font-semibold tracking-tight text-foreground/90",
                        "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                        "data-[state=open]:bg-muted/50"
                    )}
                >
                    <span className="whitespace-nowrap">{activeTab?.label || "—"}</span>
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="min-w-[200px] rounded-lg border-border/40 shadow-xl shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                >
                    {regularTabs.map((tab) => {
                        const isActive = tab.value === activeValue
                        return (
                            <DropdownMenuItem
                                key={tab.value}
                                className={cn(
                                    "cursor-pointer rounded-md transition-colors p-0 focus:bg-primary/5",
                                    isActive && "bg-primary/10"
                                )}
                            >
                                <Link
                                    href={tab.href}
                                    className="flex items-center gap-2.5 py-2 px-2.5 w-full"
                                >
                                    {tab.iconName && (
                                        <DynamicIcon
                                            name={tab.iconName}
                                            className={cn(
                                                "h-4 w-4 shrink-0",
                                                isActive ? "text-primary" : "text-muted-foreground"
                                            )}
                                        />
                                    )}
                                    <span
                                        className={cn(
                                            "text-xs font-semibold",
                                            isActive ? "text-primary" : "text-foreground/80"
                                        )}
                                    >
                                        {tab.label}
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* ── Separator + Secondary Dropdown: Sub-view Selector ── */}
            {activeSubTabs && activeSubTabs.length > 0 && (
                <>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                                "text-sm font-medium tracking-tight text-foreground/70",
                                "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                                "data-[state=open]:bg-muted/50"
                            )}
                        >
                            <span className="whitespace-nowrap">
                                {activeSubTab?.label || activeSubTabs[0]?.label || "—"}
                            </span>
                            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="start"
                            sideOffset={8}
                            className="min-w-[200px] rounded-lg border-border/40 shadow-xl shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                        >
                            {activeSubTabs.map((sub) => {
                                const isActive = sub.value === subActiveValue
                                return (
                                    <DropdownMenuItem
                                        key={sub.value}
                                        className={cn(
                                            "cursor-pointer rounded-md transition-colors p-0 focus:bg-primary/5",
                                            isActive && "bg-primary/10"
                                        )}
                                    >
                                        <Link
                                            href={sub.href}
                                            className="flex items-center gap-2.5 py-2 px-2.5 w-full"
                                        >
                                            {sub.iconName && (
                                                <DynamicIcon
                                                    name={sub.iconName}
                                                    className={cn(
                                                        "h-4 w-4 shrink-0",
                                                        isActive ? "text-primary" : "text-muted-foreground"
                                                    )}
                                                />
                                            )}
                                            <span
                                                className={cn(
                                                    "text-xs font-semibold",
                                                    isActive ? "text-primary" : "text-foreground/80"
                                                )}
                                            >
                                                {sub.label}
                                            </span>
                                        </Link>
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            {/* ── Additional Breadcrumbs ── */}
            {breadcrumbs && breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>
                    {crumb.href ? (
                        <Link 
                            href={crumb.href}
                            className="text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-sm font-semibold tracking-tight text-foreground/90">
                            {crumb.label}
                        </span>
                    )}
                </React.Fragment>
            ))}

            {/* ── Config gear icon ── */}
            {configHref && (
                <>
                    <div className="w-px h-4 bg-border/30 mx-2 shrink-0" />
                    <Link
                        href={configHref}
                        className={cn(
                            "h-7 w-7 flex items-center justify-center rounded-md shrink-0",
                            "text-muted-foreground/50 hover:text-primary hover:bg-muted/50 transition-colors",
                            activeValue === "config" && "text-primary bg-primary/10"
                        )}
                        title="Configuración del Módulo"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </Link>
                </>
            )}
        </div>
    )
}
