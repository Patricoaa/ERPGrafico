"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { DynamicIcon } from '@/components/shared'
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { getModuleIconName } from "@/lib/module-registry"
import { useAuth } from "@/contexts/AuthContext"
import type { NavigationConfig, NavigationTabConfig, SubTabConfig } from "@/components/providers/HeaderProvider"

interface ModuleNavigationMenuProps {
    navigation: NavigationConfig
}

export function ModuleNavigationMenu({ navigation }: ModuleNavigationMenuProps) {
    const { tabs, activeValue, subActiveValue, breadcrumbs } = navigation

    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const currentModuleId = segments[0] || 'dashboard'

    const { hasPermission } = useAuth()

    const regularTabs = (tabs || [])

    // Flatten: hide permission-gated items, promote their children
    const visibleItems: (NavigationTabConfig | SubTabConfig)[] = []
    for (const item of regularTabs) {
        if (item.permission && !hasPermission(item.permission)) {
            if (item.subTabs?.length) {
                visibleItems.push(...item.subTabs)
            }
        } else {
            visibleItems.push(item)
        }
    }

    return (
        <div className="flex items-center gap-0 min-w-0 h-full">
            {/* ── Module Name (Root) — static display ── */}
            {navigation.moduleName && (
                <div className="flex items-center shrink-0">
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

            <NavigationMenu className="h-full max-w-full justify-start overflow-hidden">
                <NavigationMenuList className="h-full space-x-1">
                    {visibleItems.map((item) => {
                        const isActive = item.value === activeValue
                        const hasSubTabs = item.subTabs && item.subTabs.length > 0

                        if (hasSubTabs) {
                            // Filter subtabs by permission too
                            const visibleSubTabs = item.subTabs!.filter(sub => !sub.permission || hasPermission(sub.permission))
                            
                            return (
                                <NavigationMenuItem key={item.value}>
                                    <NavigationMenuTrigger 
                                        className={cn(
                                            "h-9 px-3 bg-transparent hover:bg-muted/50 data-[state=open]:bg-muted/50 transition-colors",
                                            isActive && "text-primary bg-primary/5 hover:bg-primary/10 data-[state=open]:bg-primary/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.iconName && (
                                                <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="font-medium text-sm tracking-tight">{item.label}</span>
                                        </div>
                                    </NavigationMenuTrigger>
                                    <NavigationMenuContent>
                                        <ul className="grid w-[400px] gap-1 p-2 md:w-[500px] md:grid-cols-2 lg:w-[600px] bg-popover/95 backdrop-blur-md rounded-lg shadow-floating border border-border/40">
                                            {visibleSubTabs.map((subItem) => (
                                                <ListItem
                                                    key={subItem.value}
                                                    title={subItem.label}
                                                    href={subItem.href}
                                                    iconName={subItem.iconName}
                                                    isActive={subItem.value === subActiveValue}
                                                />
                                            ))}
                                        </ul>
                                    </NavigationMenuContent>
                                </NavigationMenuItem>
                            )
                        }

                        // No subtabs -> standard link
                        return (
                            <NavigationMenuItem key={item.value}>
                                <Link href={item.href} legacyBehavior passHref>
                                    <NavigationMenuLink 
                                        className={cn(
                                            navigationMenuTriggerStyle(),
                                            "h-9 px-3 bg-transparent hover:bg-muted/50 transition-colors",
                                            isActive && "text-primary bg-primary/5 hover:bg-primary/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.iconName && (
                                                <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="font-medium text-sm tracking-tight">{item.label}</span>
                                        </div>
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                        )
                    })}
                </NavigationMenuList>
            </NavigationMenu>

            {/* ── Additional Breadcrumbs (L5/L6) ── */}
            {breadcrumbs && breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                    <span className="text-border/60 mx-1.5 text-sm select-none">/</span>
                    {crumb.href ? (
                        <Link
                            href={crumb.href}
                            className="text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-sm font-semibold tracking-tight text-foreground/90 shrink-0">
                            {crumb.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { iconName?: string; isActive?: boolean }
>(({ className, title, children, iconName, isActive, href, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          href={href!}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted focus:bg-muted",
            isActive && "bg-primary/5 text-primary hover:bg-primary/10",
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2.5">
            {iconName && (
              <DynamicIcon 
                name={iconName} 
                className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
            )}
            <div className={cn(
                "text-sm font-semibold leading-none tracking-tight",
                isActive ? "text-primary" : "text-foreground/90"
            )}>
                {title}
            </div>
          </div>
          {children && (
              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground mt-1 ml-[26px]">
                {children}
              </p>
          )}
        </Link>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"
