"use client"

import React, { useMemo } from "react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { Granularity } from "./types"

interface Props {
    cardAccounts?: Array<{ id: number; name: string; currency: string }>
    cardAccountId?: number | null
    onCardAccountChange?: (id: number) => void
    scope?: "month" | "all"
    onScopeChange?: (scope: "month" | "all") => void
    granularity?: Granularity
    onGranularityChange?: (g: Granularity) => void
    dateRange?: { from: string; to: string } | null
    onDateRangeChange?: (range: { from: string; to: string } | null) => void
}

const SEGMENTATION_PRESETS = [
    { label: "Todo", key: "all", range: () => null as { from: string; to: string } | null },
    {
        label: "Este Mes", key: "month",
        range: () => {
            const d = new Date()
            return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
    {
        label: "Trimestre", key: "quarter",
        range: () => {
            const d = new Date()
            const from = new Date(d)
            from.setMonth(from.getMonth() - 3)
            return { from: from.toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
    {
        label: "Año", key: "year",
        range: () => {
            const d = new Date()
            const from = new Date(d)
            from.setFullYear(from.getFullYear() - 1)
            return { from: from.toISOString().split("T")[0], to: d.toISOString().split("T")[0] }
        },
    },
]

function isDateRangeEqual(a?: { from: string; to: string } | null, b?: { from: string; to: string } | null): boolean {
    if (!a && !b) return true
    if (!a || !b) return false
    return a.from === b.from && a.to === b.to
}

export function AnalyticsSegmentation({
    cardAccounts,
    cardAccountId,
    onCardAccountChange,
    scope,
    onScopeChange,
    granularity,
    onGranularityChange,
    dateRange,
    onDateRangeChange,
}: Props) {
    const activePreset = useMemo(() => {
        if (!onDateRangeChange) return "all"
        const preset = SEGMENTATION_PRESETS.find(p => isDateRangeEqual(p.range(), dateRange))
        return preset?.key ?? "custom"
    }, [dateRange, onDateRangeChange])

    const hasAny = (cardAccounts && cardAccounts.length > 0 && onCardAccountChange)
        || (scope && onScopeChange)
        || (granularity && onGranularityChange)

    if (!hasAny) return null

    return (
        <div className="flex items-center justify-center gap-5 px-6 py-2 border-t border-border shrink-0 flex-wrap">
            {cardAccounts && cardAccounts.length > 0 && onCardAccountChange && (
                <>
                    <span className="text-xs text-muted-foreground font-medium">Tarjeta:</span>
                    <Select
                        value={String(cardAccountId ?? cardAccounts[0]?.id ?? "")}
                        onValueChange={(v) => onCardAccountChange(Number(v))}
                    >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Seleccionar tarjeta" />
                        </SelectTrigger>
                        <SelectContent>
                            {cardAccounts.map((acct) => (
                                <SelectItem key={acct.id} value={String(acct.id)} className="text-xs">
                                    {acct.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </>
            )}
            {scope && onScopeChange && (
                <>
                    <span className="text-xs text-muted-foreground font-medium">Alcance:</span>
                    <Select value={scope} onValueChange={(v) => onScopeChange(v as "month" | "all")}>
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month" className="text-xs">Cargos del mes</SelectItem>
                            <SelectItem value="all" className="text-xs">Todos los cargos</SelectItem>
                        </SelectContent>
                    </Select>
                </>
            )}
            {granularity && onGranularityChange && (
                <>
                    <span className="text-xs text-muted-foreground font-medium">Rango de fechas:</span>
                    <Select
                        value={activePreset}
                        onValueChange={(key) => {
                            const preset = SEGMENTATION_PRESETS.find(p => p.key === key)
                            if (preset) onDateRangeChange?.(preset.range())
                        }}
                    >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                            {SEGMENTATION_PRESETS.map((preset) => (
                                <SelectItem key={preset.key} value={preset.key} className="text-xs">
                                    {preset.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground font-medium">Agrupar por:</span>
                    <Select
                        value={granularity}
                        onValueChange={(v) => onGranularityChange(v as "day" | "month" | "year")}
                    >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day" className="text-xs">Día</SelectItem>
                            <SelectItem value="month" className="text-xs">Mes</SelectItem>
                            <SelectItem value="year" className="text-xs">Año</SelectItem>
                        </SelectContent>
                    </Select>
                </>
            )}
        </div>
    )
}
