"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { SEG_TEXT, TAB_TOOLBAR_TRIGGER } from './search-styles'
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export interface TabItem {
    value: string
    label: string
    icon?: LucideIcon
    badge?: string | number
    hasErrors?: boolean
    hidden?: boolean
    disabled?: boolean
}

export interface TabBarProps {
    items: TabItem[]
    value: string
    onValueChange: (value: string) => void
    orientation?: "vertical" | "horizontal"
    variant?: "toolbar" | "folder" | "underline"
    className?: string
    listClassName?: string
    contentClassName?: string
    header?: React.ReactNode
    footer?: React.ReactNode
    headerClassName?: string
    containerClassName?: string
    dense?: boolean
    children: React.ReactNode
}

export function TabBar({
    items,
    value,
    onValueChange,
    orientation = "horizontal",
    variant = "toolbar",
    className,
    listClassName,
    contentClassName,
    header,
    footer,
    headerClassName,
    containerClassName,
    dense,
    children
}: TabBarProps) {
    const visible = items.filter((i) => !i.hidden)

    const isVertical = orientation === "vertical"
    const isToolbar = variant === "toolbar" && !isVertical
    const isUnderline = variant === "underline" && !isVertical
    const triggerStyles = isToolbar
        ? cn(
            TAB_TOOLBAR_TRIGGER,
            "data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm",
            "data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-accent/30",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:opacity-40 disabled:pointer-events-none",
            "inline-flex items-center justify-center whitespace-nowrap"
        )
        : isUnderline
            ? cn(
                "group relative w-auto transition-all duration-200 bg-transparent rounded-none tab-underline-cmyk",
                dense ? "h-8" : "h-12",
                "data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=inactive]:text-foreground/60 data-[state=inactive]:font-bold hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-40 disabled:pointer-events-none px-1 flex items-center justify-center gap-2"
            )
            : cn(
                "group relative w-auto h-auto transition-all duration-200",
                isVertical ? "rounded-l-lg rounded-r-none" : "rounded-t-lg rounded-b-none",
                isVertical ? "border-y border-l border-r-0" : "border-x border-t border-b-0",
                "hover:bg-muted hover:text-foreground",
                "data-[state=active]:bg-card data-[state=active]:text-primary",
                "data-[state=active]:border-transparent",
                "data-[state=active]:shadow-[-4px_4px_12px_-4px_oklch(0.12_0.02_240_/_0.10)] z-20",
                "data-[state=inactive]:bg-primary-foreground/70 data-[state=inactive]:border-border/40 data-[state=inactive]:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "disabled:opacity-20 disabled:pointer-events-none",
                isVertical
                    ? "px-2 overflow-hidden data-[state=active]:min-h-24 data-[state=active]:py-4 data-[state=inactive]:min-h-0 data-[state=inactive]:py-2.5 hover:!min-h-24 hover:!py-4"
                    : "min-w-24 px-6 py-2"
            )

    const renderTabsList = () => {
        const list = (
            <TabsList
                className={cn(
                    "bg-transparent rounded-none p-0 z-20",
                    isVertical
                        ? "h-auto w-auto flex-col items-start justify-start gap-3 col-start-1 overflow-visible max-h-full"
                        : isToolbar
                            ? "h-7 p-0 gap-0 bg-transparent items-center"
                            : isUnderline
                                ? "h-full w-auto flex-row items-end justify-start gap-2 px-1 pb-0"
                                : "h-auto w-auto flex-row items-end justify-center gap-1 px-1 pb-0",
                    listClassName
                )}
                style={isVertical ? {
                    paddingTop: header ? "5.4rem" : "0.75rem",
                    paddingBottom: footer ? "5rem" : "0.75rem",
                    marginLeft: "-2.64rem",
                } : undefined}
            >
                {visible.map((item) => {
                    const Icon = item.icon
                    return (
                        <TabsTrigger
                            key={item.value}
                            value={item.value}
                            disabled={item.disabled}
                            className={triggerStyles}
                        >
                            <span
                                className={cn(
                                    "flex items-center justify-center gap-1.5 px-1 py-1",
                                    isVertical && "[writing-mode:vertical-rl] rotate-180"
                                )}
                            >
                                {Icon && (
                                    <Icon className={cn(dense ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0", isVertical && "rotate-90")} />
                                )}
                                <span
                                    className={cn(
                                        SEG_TEXT + " leading-tight",
                                                                                "tracking-widest",
                                        "whitespace-nowrap text-center",
                                        isVertical && "group-data-[state=inactive]:hidden group-hover:!block"
                                    )}
                                >
                                    {item.label}
                                </span>
                                {item.badge !== undefined && (
                                    <span className={cn(
                                        "shrink-0 flex px-1 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground font-black leading-none",
                                        dense ? "h-[14px] min-w-[14px] text-[9px]" : "h-4 min-w-[1rem] text-[9px]",
                                        isVertical && "rotate-90",
                                        isToolbar && "border-transparent bg-accent/30",
                                        "group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground group-data-[state=active]:border-primary-foreground/30",
                                        isVertical && "group-data-[state=inactive]:hidden group-hover:!flex"
                                    )}>
                                        {item.badge}
                                    </span>
                                )}
                                {item.hasErrors && (
                                    <span
                                        aria-label="Errores en pestaña"
                                        className={cn(
                                            "shrink-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black",
                                            isVertical && "rotate-90",
                                            "bg-destructive text-destructive-foreground shadow",
                                            "ring-2 ring-primary"
                                        )}
                                    >
                                        !
                                    </span>
                                )}
                            </span>
                        </TabsTrigger>
                    )
                })}
            </TabsList>
        )

        if (isVertical) return list

        if (isToolbar) {
            return (
                <div className={cn(
                    "flex items-center justify-center shrink-0 bg-background rounded-sm px-1 h-9",
                    containerClassName
                )}>
                    {list}
                </div>
            )
        }

        if (isUnderline) {
            return (
                <div className={cn("flex items-end justify-start w-full bg-transparent", dense ? "px-3 h-8" : "px-6 h-12", headerClassName)}>
                    <div className="w-fit">
                        {list}
                    </div>
                </div>
            )
        }

        return (
            <div className={cn("flex justify-center w-full", headerClassName || "bg-muted/5")}>
                <div className={cn("p-1.5 rounded-t-[1.75rem] border-x border-t border-border/40 mb-[-1px] flex items-center justify-center", containerClassName || "bg-muted/20")}>
                    {list}
                </div>
            </div>
        )
    }

    if (isVertical) {
        return (
            <Tabs
                value={value}
                onValueChange={onValueChange}
                orientation="vertical"
                className={cn(
                    "flex-1 grid overflow-visible min-h-0 h-full",
                    "grid-cols-[0.5rem_minmax(0,1fr)] grid-rows-1",
                    className
                )}
            >
                {renderTabsList()}

                <div
                    className={cn(
                        "col-start-2 flex flex-col overflow-hidden min-h-0 min-w-0 h-full",
                        contentClassName || "bg-card rounded-t-lg"
                    )}
                >
                    {header && (
                        <div className="shrink-0 border-b border-border/60">
                            {header}
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden min-h-0 flex">
                        {children}
                    </div>
                    {footer && (
                        <div className="shrink-0 border-t border-border/60">
                            {footer}
                        </div>
                    )}
                </div>
            </Tabs>
        )
    }

    return (
        <Tabs
            value={value}
            onValueChange={onValueChange}
            className={cn("flex-1 flex flex-col overflow-hidden", className)}
        >
            <div className={cn("relative flex justify-center", isToolbar && !isVertical ? "pt-0" : "pt-3")}>
                {renderTabsList()}
            </div>

            <div className={cn("flex-1 overflow-hidden flex flex-col", contentClassName || "bg-card")}>
                {children}
            </div>
        </Tabs>
    )
}

export const TabBarContent = TabsContent
