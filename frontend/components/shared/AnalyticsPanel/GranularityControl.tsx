"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CalendarDays, Calendar, CalendarClock } from "lucide-react"
import type { Granularity } from "./types"

interface GranularityControlProps {
    value: Granularity
    onChange: (value: Granularity) => void
}

const OPTIONS: { value: Granularity; label: string; icon: typeof CalendarDays }[] = [
    { value: "day", label: "Día", icon: CalendarDays },
    { value: "month", label: "Mes", icon: Calendar },
    { value: "year", label: "Año", icon: CalendarClock },
]

export function GranularityControl({ value, onChange }: GranularityControlProps) {
    return (
        <div className="px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Agrupación
            </p>
            <ToggleGroup
                type="single"
                value={value}
                onValueChange={(v) => v && onChange(v as Granularity)}
                className="justify-start gap-1"
            >
                {OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                        <ToggleGroupItem
                            key={opt.value}
                            value={opt.value}
                            size="sm"
                            className="text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                        </ToggleGroupItem>
                    )
                })}
            </ToggleGroup>
        </div>
    )
}
