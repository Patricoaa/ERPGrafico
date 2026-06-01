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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

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
    <div className={cn("grid gap-2", className)}>
        <Button
          id="date"
          variant={"outline"}
          size="sm"
          onClick={() => handleOpenChange(true)}
          className={cn(
            "w-full justify-start text-left font-bold uppercase tracking-wider text-[10px] transition-all group",
            variant === 'outline'
              ? "bg-background/50 backdrop-blur-sm border-border/60 rounded-md hover:bg-muted/50 h-9 px-3"
              : "h-[1.5rem] border-0 bg-transparent hover:bg-transparent shadow-none px-3",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
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
              className="ml-2 p-0.5 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </div>
          )}
        </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="sm" className="p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{label}</DialogTitle>
            {tempRange?.from && (
              <p className="text-center text-base font-semibold text-primary">
                {tempRange.to
                  ? `${format(tempRange.from, "LLL dd, y", { locale: es })} — ${format(tempRange.to, "LLL dd, y", { locale: es })}`
                  : format(tempRange.from, "LLL dd, y", { locale: es })}
              </p>
            )}
          </DialogHeader>

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

          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="flex-1 h-10">
              Cancelar
            </Button>
            <Button onClick={handleConfirm} className="flex-1 h-10">
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
