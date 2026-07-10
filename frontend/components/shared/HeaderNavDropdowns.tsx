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
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { getModuleIconName } from "@/lib/module-registry"
import { useAuth } from "@/contexts/AuthContext"
import type { NavigationConfig, NavigationTabConfig, SubTabConfig } from "@/components/providers/HeaderProvider"

interface HeaderNavDropdownsProps {
    navigation: NavigationConfig
}

/**
 * Railway-style dropdown navigation for the DashboardShell top bar.
 * Primary dropdown = flat list with permission-based promotion.
 * Secondary dropdown = nested sub-menus (DropdownMenuSub) for deeper levels.
 * Tertiary/quaternary dropdowns removed — handled by sub-menus.
 */
export function HeaderNavDropdowns({ navigation }: HeaderNavDropdownsProps) {
    const { tabs, activeValue, subActiveValue, subSubActiveValue, subSubSubActiveValue, breadcrumbs } = navigation

    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const currentModuleId = segments[0] || 'dashboard'

    // Track which dropdown is open for exclusive behavior
    const [openDropdown, setOpenDropdown] = useState<'primary' | 'secondary' | null>(null)

    const regularTabs = (tabs || [])
    const activeTab = (tabs || []).find(t => t.value === activeValue)
    const activeSubTabs = activeTab?.subTabs
    const activeSubTab = activeSubTabs?.find(s => s.value === subActiveValue)

    return (
        <div className="flex items-center gap-0 min-w-0">
            {/* ── Module Name (Root) — static display ── */}
            {navigation.moduleName && (
                <div className="flex items-center">
                    {(() => {
                        const modIcon = getModuleIconName(currentModuleId)
                        return modIcon ? (
                            <DynamicIcon name={modIcon} className="h-4 w-4 shrink-0 text-primary/70 mr-1.5" />
                        ) : null
                    })()}
                    <span className="text-sm font-semibold tracking-tight text-muted-foreground">
                        {navigation.moduleName}
                    </span>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>
                </div>
            )}

            {/* ── Primary Dropdown: View Selector (flat + permission promotion) ── */}
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
                        className="min-w-[200px] rounded-lg border-border/40 shadow-floating shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                    >
                        <NavDropdownItems items={regularTabs} activeValues={[activeValue]} />
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* ── Separator + Secondary Dropdown: Sub-view Selector (with nested sub-menus) ── */}
            {activeSubTabs && activeSubTabs.length > 0 && (
                <>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>

                    <DropdownMenu
                        modal={false}
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
                            className="min-w-[200px] rounded-lg border-border/40 shadow-floating shadow-black/10 bg-popover/95 backdrop-blur-md p-1"
                        >
                            <NavDropdownItems
                                items={activeSubTabs}
                                activeValues={[subActiveValue, subSubActiveValue, subSubSubActiveValue]}
                                enableSubMenus
                            />
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

/**
 * Recursive dropdown items renderer.
 *
 * - If `enableSubMenus` is true, items with subTabs render as DropdownMenuSub
 *   (sub-menus), supporting arbitrary nesting depth.
 * - If an item has `permission` and the user lacks it, its children are promoted
 *   (rendered at the same level as siblings). Items without permission AND without
 *   children are hidden entirely.
 */
function NavDropdownItems({
    items,
    activeValues = [],
    enableSubMenus = false,
}: {
    items: (NavigationTabConfig | SubTabConfig)[]
    activeValues?: (string | undefined)[]
    enableSubMenus?: boolean
}) {
    const { hasPermission } = useAuth()
    const myActiveValue = activeValues[0]
    const childActiveValues = activeValues.slice(1)

    // Flatten: hide permission-gated items, promote their children
    const visibleItems: (NavigationTabConfig | SubTabConfig)[] = []
    for (const item of items) {
        if (item.permission && !hasPermission(item.permission)) {
            if (item.subTabs?.length) {
                visibleItems.push(...item.subTabs)
            }
        } else {
            visibleItems.push(item)
        }
    }

    return (
        <>
            {visibleItems.map((item) => {
                const isActive = item.value === myActiveValue

                // Sub-menu mode: item with children
                if (enableSubMenus && item.subTabs && item.subTabs.length > 0) {
                    return (
                        <DropdownMenuSub key={item.value}>
                            <DropdownMenuSubTrigger
                                className={cn(
                                    "cursor-pointer rounded-md focus:bg-primary/5 data-[state=open]:bg-primary/5",
                                    "py-2 px-2.5 flex items-center gap-2.5",
                                    isActive && "bg-primary/10"
                                )}
                            >
                                {item.iconName && (
                                    <DynamicIcon
                                        name={item.iconName}
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
                                    {item.label}
                                </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="min-w-[176px] rounded-lg border-border/40 shadow-floating p-1">
                                <NavDropdownItems
                                    items={item.subTabs}
                                    activeValues={childActiveValues}
                                    enableSubMenus
                                />
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )
                }

                // Flat link item
                return (
                    <DropdownMenuItem
                        key={item.value}
                        className={cn(
                            "cursor-pointer rounded-md transition-colors p-0 focus:bg-primary/5",
                            isActive && "bg-primary/10"
                        )}
                    >
                        <Link
                            href={item.href}
                            className="flex items-center gap-2.5 py-2 px-2.5 w-full"
                        >
                            {item.iconName && (
                                <DynamicIcon
                                    name={item.iconName}
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
                                {item.label}
                            </span>
                        </Link>
                    </DropdownMenuItem>
                )
            })}
        </>
    )
}
