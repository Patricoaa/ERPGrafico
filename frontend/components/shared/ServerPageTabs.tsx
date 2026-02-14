import React from "react"
import Link from "next/link"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TabConfig {
    value: string
    label: string
    icon: LucideIcon
    href: string
}

interface ServerPageTabsProps {
    tabs: TabConfig[]
    activeValue: string
    maxWidth?: string
    className?: string
}

export function ServerPageTabs({ tabs, activeValue, maxWidth = "max-w-xl", className }: ServerPageTabsProps) {
    const gridCols = {
        1: "grid-cols-1",
        2: "grid-cols-2",
        3: "grid-cols-3",
        4: "grid-cols-4",
    }[tabs.length] || "grid-cols-3"

    return (
        <div className={cn("flex justify-center", className)}>
            <div className={cn(
                "grid w-full bg-muted/50 rounded-full h-12 p-1 border",
                maxWidth,
                gridCols
            )}>
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = tab.value === activeValue
                    return (
                        <Link
                            key={tab.value}
                            href={tab.href}
                            className={cn(
                                "flex items-center justify-center rounded-full transition-all gap-2 text-sm font-medium",
                                isActive
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="max-sm:hidden">{tab.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
