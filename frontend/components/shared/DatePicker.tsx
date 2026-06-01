"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

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

interface DatePickerProps {
  date?: Date
  onDateChange: (date?: Date) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const presets = [
  { label: "Hoy", getValue: () => new Date() },
  { label: "Mañana", getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d } },
  { label: "+3 días", getValue: () => { const d = new Date(); d.setDate(d.getDate() + 3); return d } },
  { label: "+7 días", getValue: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d } },
  { label: "Fin de mes", getValue: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d } },
]

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Seleccionar fecha",
  className,
  disabled
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [tempDate, setTempDate] = React.useState<Date | undefined>(date)

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (newOpen) setTempDate(date)
    setOpen(newOpen)
  }, [date])

  const selectedKey = tempDate ? formatDateKey(tempDate) : null

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleOpenChange(true)}
        className={cn(
          "flex items-center gap-1 justify-start text-left",
          "cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          !date && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0" />
        {date ? format(date, "PPP", { locale: es }) : <span>{placeholder}</span>}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="sm" className="p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{placeholder}</DialogTitle>
            {tempDate && (
              <p className="text-center text-2xl font-bold text-primary">
                {format(tempDate, "PPP", { locale: es })}
              </p>
            )}
          </DialogHeader>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={tempDate}
              onSelect={setTempDate}
              locale={es}
              captionLayout="dropdown"
              startMonth={new Date(new Date().getFullYear() - 10, 0)}
              endMonth={new Date(new Date().getFullYear() + 10, 11)}
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {presets.map((preset) => {
              const val = preset.getValue()
              const key = formatDateKey(val)
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTempDate(val)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all border cursor-pointer",
                    "hover:bg-accent hover:border-primary/30 active:scale-95",
                    selectedKey === key
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background border-input text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="flex-1 h-10">
              Cancelar
            </Button>
            <Button onClick={() => { onDateChange(tempDate); setOpen(false) }} className="flex-1 h-10">
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
