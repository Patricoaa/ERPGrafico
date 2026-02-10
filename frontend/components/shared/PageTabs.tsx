import React from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TabConfig {
    value: string
    label: string
    icon: LucideIcon
}

interface PageTabsProps {
    tabs: TabConfig[]
    className?: string
    maxWidth?: string
}

/**
 * Reusable TabsList component for consistent page layouts.
 * Follows the design pattern of /inventory/products.
 */
export function PageTabs({ tabs, className, maxWidth = "max-w-xl" }: PageTabsProps) {
    if (!tabs || tabs.length === 0) return null

    const gridCols = {
        1: "grid-cols-1",
        2: "grid-cols-2",
        3: "grid-cols-3",
        4: "grid-cols-4",
        5: "grid-cols-5",
        6: "grid-cols-6",
    }[tabs.length] || "grid-cols-3"

    return (
        <div className={cn("flex justify-center", className)}>
            <TabsList className={cn(
                "grid w-full bg-muted/50 rounded-full h-12 p-1 border",
                maxWidth,
                gridCols
            )}>
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                        >
                            <Icon className="h-4 w-4" />
                            <span className="max-sm:hidden">{tab.label}</span>
                        </TabsTrigger>
                    )
                })}
            </TabsList>
        </div>
    )
}
