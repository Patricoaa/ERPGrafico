"use client"

import React from "react"
import { DateRangeFilter } from "@/components/shared"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown, GitCompare } from "lucide-react"
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

    return (
        <div className="flex flex-wrap items-center justify-between gap-1 mb-3">
            <div className="flex items-center gap-1">
                <div className="flex items-center -space-x-px rounded-sm">
                    {showMapeo && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onMapeoClick}
                                className="h-7 px-2 text-[9px] font-black uppercase tracking-widest gap-1 hover:bg-primary/10 border border-border/60 rounded-l-md rounded-r-none transition-colors"
                            >
                                <SlidersHorizontal className="h-3 w-3" />
                                Mapeo
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-[9px] font-black uppercase tracking-widest gap-1 border border-border/60 rounded-r-md rounded-l-none text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors"
                                    >
                                        Vista: {headerFormatLabel}
                                        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40 bg-popover border border-border/80 rounded-md shadow-floating p-1 z-50">
                                    <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => onHeaderFormatChange(val as 'year' | 'month-year' | 'day-month-year')}>
                                        <DropdownMenuRadioItem value="year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                            Año
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="month-year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                            Mes/Año
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="day-month-year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                            Día/Mes/Año
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    )}

                    {!showMapeo && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[9px] font-black uppercase tracking-widest gap-1 border border-border/60 rounded-md text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors"
                                >
                                    Vista: {headerFormatLabel}
                                    <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40 bg-popover border border-border/80 rounded-md shadow-floating p-1 z-50">
                                <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => onHeaderFormatChange(val as 'year' | 'month-year' | 'day-month-year')}>
                                    <DropdownMenuRadioItem value="year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                        Año
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="month-year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                        Mes/Año
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="day-month-year" className="text-[9px] font-black uppercase tracking-widest cursor-pointer">
                                        Día/Mes/Año
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onShowComparisonChange(!showComparison)}
                    className={cn(
                        "h-7 px-2 text-[9px] font-black uppercase tracking-widest gap-1 rounded-md border border-border/60 transition-colors",
                        showComparison
                            ? "bg-primary/10 text-primary font-black border-primary/20"
                            : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                    )}
                >
                    <GitCompare className="h-3 w-3" />
                    Comparar
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Período Actual</span>
                    <DateRangeFilter date={date} onDateChange={onDateChange} label="Período Actual" className="!h-7 !text-[9px] !tracking-widest" />
                </div>
                {showComparison && (
                    <div className="flex flex-col items-end border-l pl-4 border-muted-foreground/20">
                        <span className="text-[9px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Período Comparativo</span>
                        <DateRangeFilter date={compDate} onDateChange={onCompDateChange} label="Período Comparativo" className="!h-7 !text-[9px] !tracking-widest" />
                    </div>
                )}
            </div>
        </div>
    )
}
