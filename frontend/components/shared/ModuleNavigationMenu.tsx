"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CMYK_ACCENT, DynamicIcon } from '@/components/shared'
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { useAuth } from "@/contexts/AuthContext"
import type { NavigationConfig, NavigationTabConfig, SubTabConfig } from "@/components/providers/HeaderProvider"

interface ModuleNavigationMenuProps {
    navigation: NavigationConfig
}

export function ModuleNavigationMenu({ navigation }: ModuleNavigationMenuProps) {
    const { tabs, activeValue, subActiveValue, breadcrumbs } = navigation

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
            <NavigationMenu className="h-full max-w-full justify-start">
                <NavigationMenuList className="h-full space-x-1">
                    {visibleItems.map((item, index) => {
                        const accent = CMYK_ACCENT[index % CMYK_ACCENT.length]
                        const isActive = item.value === activeValue
                        const hasSubTabs = item.subTabs && item.subTabs.length > 0
                        const itemText = isActive
                            ? cn(accent.text, accent.hoverText)
                            : cn("text-muted-foreground", accent.hoverText, accent.openText)
                        const itemBar = (
                            <div
                                aria-hidden
                                className={cn(
                                    "absolute bottom-0 left-0 w-full h-[4px] rounded-t-sm transition-opacity duration-200",
                                    accent.bar,
                                    isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100 group-data-[state=open]/tab:opacity-100"
                                )}
                            />
                        )

                        if (hasSubTabs) {
                            // Filter subtabs by permission too
                            const visibleSubTabs = (item.subTabs ?? []).filter(sub => !sub.permission || hasPermission(sub.permission))
                            
                            return (
                                <NavigationMenuItem key={item.value}>
                                    <NavigationMenuTrigger 
                                        className={cn(
                                            "group/tab relative h-full px-3 bg-transparent transition-all duration-200",
                                            "hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent",
                                            "data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent",
                                            itemText
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.iconName && (
                                                <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="font-medium text-sm tracking-tight">{item.label}</span>
                                        </div>
                                        {itemBar}
                                    </NavigationMenuTrigger>
                                    <NavigationMenuContent>
                                        <ul className="grid w-[400px] gap-1 p-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
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
                                <NavigationMenuLink asChild
                                        className={cn(
                                            navigationMenuTriggerStyle(),
                                            "group/tab relative h-full px-3 bg-transparent transition-all duration-200",
                                            "hover:bg-transparent focus:bg-transparent",
                                            itemText
                                        )}
                                >
                                    <Link href={item.href}>
                                        <div className="flex items-center gap-2">
                                            {item.iconName && (
                                                <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="font-medium text-sm tracking-tight">{item.label}</span>
                                        </div>
                                        {itemBar}
                                    </Link>
                                </NavigationMenuLink>
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
          href={href ?? '#'}
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
