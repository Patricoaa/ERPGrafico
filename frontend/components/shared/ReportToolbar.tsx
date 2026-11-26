"use client"

import React from "react"
import type { DateRange } from "react-day-picker"
import { Columns3, Download, GitCompare, SlidersHorizontal } from "lucide-react"
import { comparisonPresets, datesOf, periodOf, presetsOf, REPORT_PERIOD_PRESETS } from "@/lib/date-presets"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandButton } from "./CommandButton"
import { PeriodPicker } from "./PeriodPicker"

export type ReportHeaderFormat = "year" | "month-year" | "day-month-year"

const HEADER_FORMATS: readonly { value: ReportHeaderFormat; label: string }[] = [
    { value: "year", label: "Año" },
    { value: "month-year", label: "Mes/Año" },
    { value: "day-month-year", label: "Día/Mes/Año" },
]

const isHeaderFormat = (value: string): value is ReportHeaderFormat => HEADER_FORMATS.some((f) => f.value === value)

const REPORT_PRESETS = presetsOf(REPORT_PERIOD_PRESETS)

export interface ReportToolbarProps {
    headerFormat: ReportHeaderFormat
    onHeaderFormatChange: (format: ReportHeaderFormat) => void
    date: DateRange | undefined
    onDateChange: (range: DateRange | undefined) => void
    showComparison: boolean
    onShowComparisonChange: (show: boolean) => void
    compDate: DateRange | undefined
    onCompDateChange: (range: DateRange | undefined) => void
    showMapeo?: boolean
    onMapeoClick?: () => void
    onExport?: () => void
    showHeaderFormat?: boolean
}

/**
 * Report command bar (ADR-0160 §2): scope (period, comparison), presentation (column header),
 * then actions (mapping, export). Same grammar as `Collection.Toolbar`: each button shows its value,
 * the tool name lives in the tooltip and the accessible name.
 */
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
    onExport,
    showHeaderFormat = true,
}: ReportToolbarProps) {
    const period = periodOf(date)
    const from = period?.from
    const to = period?.to
    const comparePresets = React.useMemo(() => comparisonPresets(from && to ? { from, to } : null), [from, to])
    const headerLabel = HEADER_FORMATS.find((f) => f.value === headerFormat)?.label

    return (
        <div role="toolbar" aria-label="Herramientas del informe" className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5 px-1">
            <PeriodPicker
                name="Período"
                value={period}
                presets={REPORT_PRESETS}
                clearable={false}
                onChange={(next) => next && onDateChange(datesOf(next))}
            />
            <PeriodPicker
                name="Comparar con"
                icon={GitCompare}
                value={showComparison ? periodOf(compDate) : null}
                presets={comparePresets}
                onChange={(next) => {
                    if (next) onCompDateChange(datesOf(next))
                    onShowComparisonChange(next !== null)
                }}
            />
            {showHeaderFormat && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <CommandButton icon={Columns3} name="Encabezado de columnas" value={headerLabel} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuLabel className="text-3xs uppercase tracking-wide text-muted-foreground">Encabezado de columnas</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={headerFormat} onValueChange={(value) => isHeaderFormat(value) && onHeaderFormatChange(value)}>
                            {HEADER_FORMATS.map((f) => (
                                <DropdownMenuRadioItem key={f.value} value={f.value} className="text-xs">
                                    {f.label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <div className="flex-1" aria-hidden />
            {showMapeo && <CommandButton icon={SlidersHorizontal} name="Mapeo de cuentas" onClick={onMapeoClick} />}
            {onExport && <CommandButton icon={Download} name="Exportar" onClick={onExport} />}
        </div>
    )
}
