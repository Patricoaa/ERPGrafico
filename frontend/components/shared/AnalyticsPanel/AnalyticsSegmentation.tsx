"use client"

import React, { useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { SEG_TRIGGER, SEG_DROPDOWN_ITEM, SEG_ACTIVE, SEG_INACTIVE } from '../SegmentationBar/styles'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
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

    const accountLabel = cardAccountId
        ? cardAccounts?.find(a => a.id === cardAccountId)?.name
        : null

    return (
        <div className="flex items-center justify-center gap-1 px-1 py-1.5 border-t border-border shrink-0 flex-wrap">
            {cardAccounts && cardAccounts.length > 0 && onCardAccountChange && (
                <>
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">Tarjeta:</span>
                <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    SEG_TRIGGER,
                                    accountLabel ? SEG_ACTIVE : SEG_INACTIVE,
                                )}
                            >
                                <span className="truncate max-w-[140px]">{accountLabel ?? "Seleccionar"}</span>
                                <ChevronDown className="h-3 w-3 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[220px] p-1">
                            <DropdownMenuRadioGroup
                                value={String(cardAccountId ?? "")}
                                onValueChange={(v) => onCardAccountChange(Number(v))}
                            >
                                {cardAccounts.map((acct) => (
                                    <DropdownMenuRadioItem
                                        key={acct.id}
                                        value={String(acct.id)}
                                        className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}
                                    >
                                        {acct.name}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                </>
            )}

            {scope && onScopeChange && (
                <>
                <span className="text-xs font-semibold tracking-tight text-muted-foreground">Alcance:</span>
                <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    SEG_TRIGGER,
                                    SEG_ACTIVE
                                )}
                            >
                                {scope === "month" ? "Cargos del mes" : "Todos los cargos"}
                                <ChevronDown className="h-3 w-3 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[180px] p-1">
                            <DropdownMenuRadioGroup value={scope} onValueChange={(v) => onScopeChange(v as "month" | "all")}>
                                <DropdownMenuRadioItem value="month" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                    Cargos del mes
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="all" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                    Todos los cargos
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                </>
            )}

            {granularity && onGranularityChange && (
                <>
                    <span className="text-xs font-semibold tracking-tight text-muted-foreground">Rango:</span>
                    <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        SEG_TRIGGER,
                                        activePreset !== "all" ? SEG_ACTIVE : SEG_INACTIVE,
                                    )}
                                >
                                    {SEGMENTATION_PRESETS.find(p => p.key === activePreset)?.label ?? "Seleccionar"}
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[140px] p-1">
                                <DropdownMenuRadioGroup value={activePreset} onValueChange={(key) => {
                                    const preset = SEGMENTATION_PRESETS.find(p => p.key === key)
                                    if (preset) onDateRangeChange?.(preset.range())
                                }}>
                                    {SEGMENTATION_PRESETS.map((preset) => (
                                        <DropdownMenuRadioItem key={preset.key} value={preset.key} className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                            {preset.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <span className="text-xs font-semibold tracking-tight text-muted-foreground">Agrupar:</span>
                    <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        SEG_TRIGGER,
                                        granularity ? SEG_ACTIVE : SEG_INACTIVE,
                                    )}
                                >
                                    {granularity === "day" ? "Día" : granularity === "month" ? "Mes" : granularity === "year" ? "Año" : "Seleccionar"}
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[120px] p-1">
                                <DropdownMenuRadioGroup value={granularity} onValueChange={(v) => onGranularityChange(v as "day" | "month" | "year")}>
                                    <DropdownMenuRadioItem value="day" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                        Día
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="month" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                        Mes
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="year" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                        Año
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>
            )}
        </div>
    )
}
