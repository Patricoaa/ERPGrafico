"use client"

import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

export function ChartTooltip({ className, style, children }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("rounded-lg border bg-background p-2 shadow-floating", className)}
            style={style}
        >
            {children}
        </div>
    )
}
