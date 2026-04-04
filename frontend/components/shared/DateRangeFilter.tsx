"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangeFilterProps {
    className?: string
    onRangeChange: (range: DateRange | undefined) => void
    label?: string
    defaultRange?: DateRange
}

export function DateRangeFilter({
    className,
    onRangeChange,
    label = "Filtrar por fecha",
    defaultRange,
}: DateRangeFilterProps) {
    const [date, setDate] = React.useState<DateRange | undefined>(defaultRange)

    const handleSelect = (newDate: DateRange | undefined) => {
        setDate(newDate)
        onRangeChange(newDate)
    }

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation()
        setDate(undefined)
        onRangeChange(undefined)
    }

    return (
        <div className={cn("relative", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        size="sm"
                        className={cn(
                            "w-[260px] justify-start text-left font-normal bg-background/50 backdrop-blur-sm border-sidebar-border/50 rounded-xl hover:bg-muted/50 transition-all group h-9",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        <span className="truncate flex-1">
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
                                className="ml-2 p-0.5 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <X className="h-3 w-3" />
                            </div>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-sidebar-border/30 overflow-hidden shadow-2xl" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                        locale={es}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
