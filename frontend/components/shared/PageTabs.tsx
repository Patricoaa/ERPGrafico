import React from "react"
import Link from "next/link"
import { ChevronDown, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface SubTabConfig {
    value: string
    label: string
    href: string
    iconName?: string
}

export interface TabConfig {
    value: string
    label: string
    iconName: string
    href: string
    subTabs?: SubTabConfig[]
}

interface PageTabsProps {
    tabs: TabConfig[]
    activeValue: string
    subActiveValue?: string
    maxWidth?: string
    className?: string
    variant?: "default" | "minimal" // Keeping for backwards compatibility
}

/**
 * Reusable Page Navigation Tabs component with an Industrial Underline style.
 * Maps navigation links to a standardized tab-like experience.
 * Supports dropdown sub-tabs if a tab has `subTabs` configured.
 */
export function PageTabs({ tabs, activeValue, subActiveValue, maxWidth, className, variant }: PageTabsProps) {
    return (
        <div className={cn("w-full border-b border-border/40 bg-muted/5", className)}>
            <div className={cn("px-4", maxWidth)}>
                <nav className="flex justify-start -mb-[1px]">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const isActive = tab.value === activeValue
                            const hasSubTabs = tab.subTabs && tab.subTabs.length > 0

                            const tabContent = (
                                <>
                                    <DynamicIcon 
                                        name={tab.iconName} 
                                        className={cn(
                                            "h-4 w-4 transition-transform duration-300 group-hover:scale-110",
                                            isActive ? "text-primary" : "text-muted-foreground"
                                        )} 
                                    />
                                    <span className="max-sm:hidden">{tab.label}</span>
                                    {hasSubTabs && (
                                        <ChevronDown className="h-3 w-3 opacity-50 ml-1 transition-transform group-data-[state=open]:rotate-180" />
                                    )}
                                    
                                    {/* Subtle active glow indicator */}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-primary/5 blur-sm -z-10 rounded-t-lg" />
                                    )}
                                </>
                            )

                            const tabClass = cn(
                                "flex items-center justify-center gap-2 px-6 py-4 transition-all duration-300 relative group cursor-pointer",
                                "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.05em] focus:outline-none",
                                isActive
                                    ? "text-primary bg-primary/5"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10",
                                "border-b-2",
                                isActive ? "border-primary" : "border-transparent hover:border-border/60"
                            )

                            if (hasSubTabs) {
                                return (
                                    <DropdownMenu key={tab.value}>
                                        <DropdownMenuTrigger className={tabClass}>
                                            {tabContent}
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent 
                                            align="start" 
                                            className="w-48 rounded-sm border-border/40 shadow-xl shadow-black/5 bg-background/95 backdrop-blur-sm p-1 mt-1"
                                        >
                                            {tab.subTabs!.map((sub) => {
                                                const isSubActive = isActive && sub.value === subActiveValue
                                                return (
                                                    <DropdownMenuItem 
                                                        key={`${tab.value}-${sub.value}`} 
                                                        className={cn(
                                                            "cursor-pointer my-0.5 rounded-[0.2rem] transition-colors duration-200 focus:bg-primary/5 p-0",
                                                            isSubActive ? "bg-primary/10" : ""
                                                        )}
                                                    >
                                                        <Link href={sub.href} className="flex items-center gap-2.5 py-1.5 px-2 w-full h-full">
                                                            {sub.iconName ? (
                                                                <DynamicIcon 
                                                                    name={sub.iconName} 
                                                                    className={cn(
                                                                        "h-3.5 w-3.5",
                                                                        isSubActive ? "text-primary" : "text-muted-foreground"
                                                                    )} 
                                                                />
                                                            ) : (
                                                                <div className="w-3.5 h-3.5" />
                                                            )}
                                                            <span className={cn(
                                                                "text-[10px] font-heading uppercase tracking-wider font-black",
                                                                isSubActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                                            )}>
                                                                {sub.label}
                                                            </span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                )
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )
                            }

                            return (
                                <Link
                                    key={tab.value}
                                    href={tab.href}
                                    className={tabClass}
                                >
                                    {tabContent}
                                </Link>
                            )
                        })}
                    </div>
                </nav>
            </div>
        </div>
    )
}
