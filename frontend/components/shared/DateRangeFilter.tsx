"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { type DateRange } from "react-day-picker"

import { SEG_TRIGGER } from './search-styles'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { BaseModal } from "./BaseModal"

interface DateRangeFilterProps {
    className?: string
    date?: DateRange | undefined
    onDateChange: (date: DateRange | undefined) => void
    label?: string
    defaultRange?: DateRange
    variant?: 'outline' | 'ghost'
}

export function DateRangeFilter({
    className,
    date: controlledDate,
    onDateChange,
    label = "Buscar por fecha",
    defaultRange,
    variant = 'outline',
}: DateRangeFilterProps) {
    const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(defaultRange)
    const date = controlledDate !== undefined ? controlledDate : internalDate
    const [open, setOpen] = React.useState(false)
    const [tempRange, setTempRange] = React.useState<DateRange | undefined>(date)

    const handleOpenChange = React.useCallback((newOpen: boolean) => {
        if (newOpen) setTempRange(date)
        setOpen(newOpen)
    }, [date])

    const handleConfirm = () => {
        const newDate = tempRange?.from ? tempRange : undefined
        setInternalDate(newDate)
        onDateChange(newDate)
        setOpen(false)
    }

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation()
        setInternalDate(undefined)
        onDateChange(undefined)
    }

    return (
        <div className={variant === 'ghost' ? "inline-flex items-center" : "grid gap-2"}>
            <Button
                id="date"
                variant={variant === 'ghost' ? 'ghost' : 'outline'}
                size="sm"
                onClick={() => handleOpenChange(true)}
                className={cn(
                    "justify-start text-left transition-all group",
                    variant === 'outline'
                        ? "w-full text-xs font-semibold tracking-tight bg-background/50 backdrop-blur-sm border-border/60 rounded-md hover:bg-muted/50 h-9 px-3"
                        : SEG_TRIGGER,
                    !date && "text-muted-foreground",
                    className
                )}
            >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                <span className={cn("truncate", variant !== 'ghost' && "flex-1")}>
                    {date?.from ? (
                        date.to ? (
                            <>
                                {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                {format(date.to, "LLL dd, y", { locale: es })}
                            </>
                        ) : (
                            format(date.from, "LLL dd, y", { locale: es })
                        )
                    ) : (
                        <span>{label}</span>
                    )}
                </span>
                {date && (
                    <div
                        onClick={clearDate}
                        className="ml-1.5 p-0.5 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <span className="sr-only">Limpiar fecha</span>
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                )}
            </Button>

            <BaseModal
                open={open}
                onOpenChange={handleOpenChange}
                centered={true}
                title={label}
                description={tempRange?.from ? (
                    <p className="text-center text-base font-semibold text-primary">
                        {tempRange.to
                            ? `${format(tempRange.from, "LLL dd, y", { locale: es })} — ${format(tempRange.to, "LLL dd, y", { locale: es })}`
                            : format(tempRange.from, "LLL dd, y", { locale: es })}
                    </p>
                ) : undefined}
                size="md"
                hideScrollArea
                contentClassName="flex flex-col items-center pb-6"
                footer={
                    <>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="flex-1 h-10">
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleConfirm} className="flex-1 h-10">
                            Aceptar
                        </Button>
                    </>
                }
            >
                <div className="flex justify-center">
                    <Calendar
                        mode="range"
                        defaultMonth={tempRange?.from}
                        selected={tempRange}
                        onSelect={setTempRange}
                        numberOfMonths={2}
                        locale={es}
                        captionLayout="dropdown"
                        startMonth={new Date(new Date().getFullYear() - 10, 0)}
                        endMonth={new Date(new Date().getFullYear() + 10, 11)}
                    />
                </div>
            </BaseModal>
        </div>
    )
}