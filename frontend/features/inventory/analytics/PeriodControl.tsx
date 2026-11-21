"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PERIOD_OPTIONS, type PeriodKey } from "./period"

interface PeriodControlProps {
    value: PeriodKey
    onChange: (value: PeriodKey) => void
}

/** Período único del análisis de producto (pie del riel, como GranularityControl). */
export function PeriodControl({ value, onChange }: PeriodControlProps) {
    return (
        <div className="px-3 py-2">
            <p className="mb-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Período</p>
            <ToggleGroup
                type="single"
                value={value}
                onValueChange={(v) => {
                    if (v) onChange(v as PeriodKey)
                }}
                aria-label="Período"
                className="flex-wrap justify-start gap-1"
            >
                {PERIOD_OPTIONS.map((option) => (
                    <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        size="sm"
                        className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    )
}
