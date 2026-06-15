"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from '@/components/shared'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MODULE_REGISTRY } from "@/lib/module-registry"
import { ModuleLauncher } from "@/components/shared/ModuleLauncher"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

interface HeaderNavDropdownsProps {
    navigation: NavigationConfig
    /** Icon rendered before the primary dropdown title */
    iconName?: string
}

/**
 * Railway-style dropdown navigation for the DashboardShell top bar.
 * Replaces horizontal PageTabs with:
 *   [Icon] [Active View ▾]  ·  [Active Sub-view ▾]
 */
export function HeaderNavDropdowns({ navigation, iconName }: HeaderNavDropdownsProps) {
    const { tabs, activeValue, subActiveValue, subSubActiveValue, subSubSubActiveValue, breadcrumbs } = navigation

    // Derive current module id from pathname (same logic as DashboardShell)
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const currentModuleId = segments[0] || 'dashboard'
    const isModuleInRegistry = !!MODULE_REGISTRY[currentModuleId]

    // Track which dropdown is open for exclusive behavior
    const [openDropdown, setOpenDropdown] = useState<'module' | 'primary' | 'secondary' | 'tertiary' | 'quaternary' | null>(null)
    const [isModuleLauncherOpen, setIsModuleLauncherOpen] = useState(false)

    // Separate config tab from regular tabs
    const regularTabs = (tabs || [])
    const activeTab = (tabs || []).find(t => t.value === activeValue)
    const activeSubTabs = activeTab?.subTabs
    const activeSubTab = activeSubTabs?.find(s => s.value === subActiveValue)
    const activeSubSubTabs = activeSubTab?.subTabs
    const activeSubSubTab = activeSubSubTabs?.find(s => s.value === subSubActiveValue)
    const activeSubSubSubTabs = activeSubSubTab?.subTabs
    const activeSubSubSubTab = activeSubSubSubTabs?.find(s => s.value === subSubSubActiveValue)

    return (
        <div className="flex items-center gap-0 min-w-0">
            {/* ── Module Name (Root) — Module Selector (full-screen launcher) ── */}
            {navigation.moduleName && isModuleInRegistry && (
                <div className="flex items-center">
                    <button
                        onClick={() => setIsModuleLauncherOpen(true)}
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 -ml-2 rounded-md transition-colors cursor-pointer",
                            "text-sm font-semibold tracking-tight text-muted-foreground",
                            "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                        )}
                    >
                        {(() => {
                            const modIcon = iconName || MODULE_REGISTRY[currentModuleId]?.iconName
                            return modIcon ? (
                                <DynamicIcon name={modIcon} className="h-4 w-4 shrink-0 text-primary/70" />
                            ) : null
                        })()}
                        <span className="whitespace-nowrap">{navigation.moduleName}</span>
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    </button>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>
                    <ModuleLauncher
                        open={isModuleLauncherOpen}
                        onClose={() => setIsModuleLauncherOpen(false)}
                    />
                </div>
            )}

            {/* ── Module Name (Root) — Static fallback for non-registry modules (e.g. Settings) ── */}
            {navigation.moduleName && !isModuleInRegistry && (
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
            {regularTabs.length > 0 && (
                <DropdownMenu
                    open={openDropdown === 'primary'}
                    onOpenChange={(open) => setOpenDropdown(open ? 'primary' : null)}
                >
                    <DropdownMenuTrigger
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 -ml-2 rounded-md transition-colors",
                            "text-sm font-semibold tracking-tight text-foreground/90",
                            "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                            "data-[state=open]:bg-muted/50"
                        )}
                    >
                        {activeTab?.iconName && (
                            <DynamicIcon name={activeTab.iconName} className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                        )}
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
                                <React.Fragment key={tab.value}>
                                    <DropdownMenuItem
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
                                </React.Fragment>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* ── Separator + Secondary Dropdown: Sub-view Selector ── */}
            {activeSubTabs && activeSubTabs.length > 0 && (
                <>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>

                    <DropdownMenu
                        open={openDropdown === 'secondary'}
                        onOpenChange={(open) => setOpenDropdown(open ? 'secondary' : null)}
                    >
                        <DropdownMenuTrigger
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                                "text-sm font-medium tracking-tight text-foreground/70",
                                "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                                "data-[state=open]:bg-muted/50"
                            )}
                        >
                        {(() => {
                            const st = activeSubTab || activeSubTabs[0]
                            return st?.iconName ? (
                                <DynamicIcon name={st.iconName} className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            ) : null
                        })()}
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

            {/* ── Separator + Tertiary Dropdown: Sub-sub-view Selector ── */}
            {activeSubSubTabs && activeSubSubTabs.length > 0 && (
                <>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>

                    <DropdownMenu
                        open={openDropdown === 'tertiary'}
                        onOpenChange={(open) => setOpenDropdown(open ? 'tertiary' : null)}
                    >
                        <DropdownMenuTrigger
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                                "text-sm font-medium tracking-tight text-foreground/70",
                                "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                                "data-[state=open]:bg-muted/50"
                            )}
                        >
                        {(() => {
                            const st = activeSubSubTab || activeSubSubTabs[0]
                            return st?.iconName ? (
                                <DynamicIcon name={st.iconName} className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            ) : null
                        })()}
                        <span className="whitespace-nowrap">
                            {activeSubSubTab?.label || activeSubSubTabs[0]?.label || "—"}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="start"
                        sideOffset={8}
                        className="min-w-[200px] rounded-lg border-border/40 shadow-xl shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                    >
                        {activeSubSubTabs.map((sub) => {
                                const isActive = sub.value === subSubActiveValue
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

            {/* ── Separator + Quaternary Dropdown: Sub-sub-sub-view Selector ── */}
            {activeSubSubSubTabs && activeSubSubSubTabs.length > 0 && (
                <>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>

                    <DropdownMenu
                        open={openDropdown === 'quaternary'}
                        onOpenChange={(open) => setOpenDropdown(open ? 'quaternary' : null)}
                    >
                        <DropdownMenuTrigger
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                                "text-sm font-medium tracking-tight text-foreground/70",
                                "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                                "data-[state=open]:bg-muted/50"
                            )}
                        >
                        {(() => {
                            const st = activeSubSubSubTab || activeSubSubSubTabs[0]
                            return st?.iconName ? (
                                <DynamicIcon name={st.iconName} className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            ) : null
                        })()}
                        <span className="whitespace-nowrap">
                            {activeSubSubSubTab?.label || activeSubSubSubTabs[0]?.label || "—"}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="start"
                        sideOffset={8}
                        className="min-w-[200px] rounded-lg border-border/40 shadow-xl shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                    >
                        {activeSubSubSubTabs.map((sub) => {
                                const isActive = sub.value === subSubSubActiveValue
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
        </div>
    )
}
