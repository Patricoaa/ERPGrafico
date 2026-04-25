"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export interface FormTabItem {
    value: string
    label: string
    icon?: LucideIcon
    badge?: string | number
    hasErrors?: boolean
    hidden?: boolean
    disabled?: boolean
}

export interface FormTabsProps {
    items: FormTabItem[]
    value: string
    onValueChange: (value: string) => void
    orientation?: "vertical" | "horizontal"
    variant?: "folder" | "underline"
    className?: string
    listClassName?: string
    /** @deprecated Use listClassName instead */
    tabsListClassName?: string
    railWidth?: string
    /** Optional header slot — renders inside card at top, above content */
    header?: React.ReactNode
    /** Optional footer slot — renders inside card at bottom, below content */
    footer?: React.ReactNode
    children: React.ReactNode
}

export function FormTabs({
    items,
    value,
    onValueChange,
    orientation = "vertical",
    variant = "folder",
    className,
    listClassName,
    tabsListClassName,
    header,
    footer,
    children,
}: FormTabsProps) {
    const visible = items.filter((i) => !i.hidden)
    const effectiveListClassName = listClassName || tabsListClassName

    const isVertical = orientation === "vertical"

    // Common Trigger Style (Industrial Premium Sawtooth)
    const triggerStyles = cn(
        "group relative w-auto h-auto transition-all duration-200",
        isVertical ? "rounded-tl-2xl rounded-tr-none" : "rounded-t-2xl",
        "rounded-b-none",
        isVertical ? "border-y border-l border-r-0" : "border-x border-t border-b-0",
        "hover:bg-primary hover:text-primary-foreground hover:shadow-md",
        "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        "data-[state=active]:border-primary",
        "data-[state=active]:shadow-[-6px_4px_12px_-4px_rgba(0,0,0,0.15)] z-20",
        "data-[state=inactive]:bg-card data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        isVertical ? "min-h-24 px-2 py-4" : "min-w-24 px-6 py-2"
    )

    const renderTabsList = () => {
        const list = (
            <TabsList
                className={cn(
                    "bg-transparent rounded-none p-0 z-20",
                    isVertical ? "h-auto w-auto flex-col items-start justify-start gap-3 col-start-1 overflow-visible max-h-full" 
                               : "h-auto w-auto flex-row items-end justify-center gap-1 px-1 pb-0",
                    effectiveListClassName
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
                                    "flex items-center justify-center gap-2 px-1 py-1",
                                    isVertical && "[writing-mode:vertical-rl] rotate-180"
                                )}
                            >
                                {Icon && (
                                    <Icon className={cn("h-4 w-4 shrink-0", isVertical && "rotate-90")} />
                                )}
                                <span
                                    className={cn(
                                        "font-bold text-[11px] uppercase tracking-widest leading-tight",
                                        "whitespace-normal break-words text-center",
                                        "max-h-[16ch]"
                                    )}
                                >
                                    {item.label}
                                </span>
                                {item.badge !== undefined && (
                                    <span className={cn(
                                        "shrink-0 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground text-[9px] font-bold leading-none",
                                        isVertical && "rotate-90",
                                        "group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground group-data-[state=active]:border-primary-foreground/30"
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

        if (isVertical) return list;

        return (
            <div className="flex justify-center w-full bg-muted/5">
                <div className="bg-muted/20 p-1.5 rounded-t-[1.75rem] border-x border-t border-border/40 mb-[-1px] flex items-center justify-center">
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
                    "flex-1 grid overflow-visible min-h-0",
                    "grid-cols-[0px_minmax(0,1fr)]",
                    className
                )}
            >
                {renderTabsList()}

                <div
                    className={cn(
                        "col-start-2 flex flex-col overflow-hidden min-h-0 min-w-0",
                        "bg-card rounded-xl"
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
            <div className="relative">
                {renderTabsList()}
            </div>

            <div className={cn("flex-1 overflow-hidden bg-card")}>
                {children}
            </div>
        </Tabs>
    )
}


export { TabsContent as FormTabsContent }
