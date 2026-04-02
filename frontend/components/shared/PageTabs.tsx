import React from "react"
import Link from "next/link"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from "@/components/ui/dynamic-icon"

interface TabConfig {
    value: string
    label: string
    iconName: string
    href: string
}

interface PageTabsProps {
    tabs: TabConfig[]
    activeValue: string
    maxWidth?: string
    className?: string
}

/**
 * Reusable Page Navigation Tabs component with an Industrial Underline style.
 * Maps navigation links to a standardized tab-like experience.
 */
export function PageTabs({ tabs, activeValue, maxWidth, className }: PageTabsProps) {
    return (
        <div className={cn("w-full border-b border-border/40 bg-muted/5", className)}>
            <div className={cn("px-4", maxWidth)}>
                <nav className="flex justify-start -mb-[1px]">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const isActive = tab.value === activeValue
                            return (
                                <Link
                                    key={tab.value}
                                    href={tab.href}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-6 py-4 transition-all duration-300 relative group",
                                        "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.05em]",
                                        isActive
                                            ? "text-primary bg-primary/5"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/10",
                                        "border-b-2",
                                        isActive ? "border-primary" : "border-transparent hover:border-border/60"
                                    )}
                                >
                                    <DynamicIcon 
                                        name={tab.iconName} 
                                        className={cn(
                                            "h-4 w-4 transition-transform duration-300 group-hover:scale-110",
                                            isActive ? "text-primary" : "text-muted-foreground"
                                        )} 
                                    />
                                    <span className="max-sm:hidden">{tab.label}</span>
                                    
                                    {/* Subtle active glow indicator */}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-primary/5 blur-sm -z-10 rounded-t-lg" />
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                </nav>
            </div>
        </div>
    )
}
