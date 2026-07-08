"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared"

interface Segment {
    label: string
    value: number
    bgClass: string
    textClass: string
}

interface DistributionBarProps {
    segments: Segment[]
    className?: string
}

export function DistributionBar({ segments, className }: DistributionBarProps) {
    const total = segments.reduce((acc, s) => acc + Math.abs(s.value), 0)
    if (total === 0) return null

    return (
        <div className={cn("overflow-hidden rounded-md border shadow-card", className)}>
            <div className="h-10 w-full flex text-[10px] font-bold uppercase tracking-tighter">
                {segments.map((seg, i) => {
                    const pct = total > 0 ? (Math.abs(seg.value) / total) * 100 : 0
                    if (pct < 0.5) return null
                    return (
                        <div
                            key={seg.label}
                            style={{ width: `${pct}%` }}
                            className={cn(
                                seg.bgClass,
                                "flex items-center justify-center p-1 transition-all duration-500 ease-premium whitespace-nowrap overflow-hidden min-w-0",
                                i < segments.length - 1 && "border-r border-border"
                            )}
                            title={`${seg.label}: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(seg.value)}`}
                        >
                            <span className="hidden sm:inline mr-0.5 truncate">{seg.label}:</span>
                            <MoneyDisplay amount={seg.value} inline className={cn("text-[10px]", seg.textClass)} />
                        </div>
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-1.5 bg-muted/20 border-t border-border/40">
                {segments.map((seg) => {
                    const pct = total > 0 ? ((Math.abs(seg.value) / total) * 100).toFixed(1) : "0.0"
                    return (
                        <div key={seg.label} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            <span className={cn("w-2 h-2 rounded-full", seg.bgClass)} />
                            <span>{seg.label}</span>
                            <span className="font-mono tabular-nums">{pct}%</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
