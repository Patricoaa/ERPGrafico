"use client"

import React from "react"
import { DateRangeFilter } from "@/components/shared"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown, GitCompare } from "lucide-react"
import { SEG_TRIGGER, SEG_DROPDOWN_ITEM } from './SegmentationBar/styles'
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu"

export interface ReportToolbarProps {
    headerFormat: 'year' | 'month-year' | 'day-month-year'
    onHeaderFormatChange: (format: 'year' | 'month-year' | 'day-month-year') => void
    date: DateRange | undefined
    onDateChange: (range: DateRange | undefined) => void
    showComparison: boolean
    onShowComparisonChange: (show: boolean) => void
    compDate: DateRange | undefined
    onCompDateChange: (range: DateRange | undefined) => void
    showMapeo?: boolean
    onMapeoClick?: () => void
}

export function ReportToolbar({
    headerFormat,
    onHeaderFormatChange,
    date,
    onDateChange,
    showComparison,
    onShowComparisonChange,
    compDate,
    onCompDateChange,
    showMapeo = true,
    onMapeoClick,
}: ReportToolbarProps) {
    const headerFormatLabel = headerFormat === 'year' ? 'Año' : headerFormat === 'month-year' ? 'Mes/Año' : 'Día/Mes/Año'

    const btnBase = `${SEG_TRIGGER} transition-colors`

    return (
        <div className="flex flex-wrap items-center justify-between shrink-0 h-9 bg-background rounded-sm px-1 mb-3">
            <div className="flex items-center gap-1">
                {showMapeo && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMapeoClick}
                        className={cn(btnBase, "hover:bg-accent/30 text-muted-foreground hover:text-foreground")}
                    >
                        <SlidersHorizontal className="h-3 w-3" />
                        Mapeo
                    </Button>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(btnBase, "text-muted-foreground hover:bg-accent/30 hover:text-foreground")}
                        >
                            Vista: {headerFormatLabel}
                            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[180px] p-1">
                        <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => onHeaderFormatChange(val as 'year' | 'month-year' | 'day-month-year')}>
                            <DropdownMenuRadioItem value="year" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                Año
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="month-year" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                Mes/Año
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="day-month-year" className={`${SEG_DROPDOWN_ITEM} cursor-pointer`}>
                                Día/Mes/Año
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onShowComparisonChange(!showComparison)}
                    className={cn(
                        btnBase,
                        showComparison
                            ? "bg-accent/50 text-foreground"
                            : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                    )}
                >
                    <GitCompare className="h-3 w-3" />
                    Comparar
                </Button>
            </div>

            <div className="flex items-center gap-1">
                <DateRangeFilter date={date} onDateChange={onDateChange} label="Período Actual" variant="ghost" />
                {showComparison && (
                    <div className="flex items-center border-l border-border/60 pl-2 ml-1">
                        <DateRangeFilter date={compDate} onDateChange={onCompDateChange} label="Período Comparativo" variant="ghost" />
                    </div>
                )}
            </div>
        </div>
    )
}
