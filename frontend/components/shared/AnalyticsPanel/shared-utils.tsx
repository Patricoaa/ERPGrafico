"use client"

import React from "react"
import { cn } from "@/lib/utils"
import type { TimelineEvent } from "./types"

export function TimelineView({ events }: { events: TimelineEvent[] }) {
    if (!events.length) {
        return (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
                Sin eventos próximos
            </p>
        )
    }

    const statusColor = {
        success: "bg-success border-success/30",
        warning: "bg-warning border-warning/30",
        destructive: "bg-destructive border-destructive/30",
        neutral: "bg-muted border-border",
    }

    return (
        <div className="space-y-0">
            {events.map((event, i) => (
                <div key={i} className="flex gap-3 pb-4 relative last:pb-0">
                    <div className="flex flex-col items-center">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full border-2 mt-1.5 shrink-0",
                            statusColor[event.status || "neutral"],
                        )} />
                        {i < events.length - 1 && (
                            <div className="w-px flex-1 bg-border/50 mt-1" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                                {event.date}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                                {event.label}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {event.description}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

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
