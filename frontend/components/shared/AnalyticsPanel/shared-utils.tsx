"use client"

import React from "react"
import { cn } from "@/lib/utils"

export function SummaryTable({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
    return (
        <div className="rounded-md border border-border/50 overflow-hidden">
            {rows.map((row, i) => (
                <div
                    key={i}
                    className={cn(
                        "flex items-center justify-between px-4 py-2.5",
                        i % 2 === 0 ? "bg-card" : "bg-muted/20",
                    )}
                >
                    <span className="text-xs font-medium text-muted-foreground">
                        {row.label}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                        {row.value}
                    </span>
                </div>
            ))}
        </div>
    )
}
