"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface ViewControlProps<T extends string | number> {
    label: string
    value: T
    options: ReadonlyArray<{ value: T; label: string }>
    onChange: (value: T) => void
}

/** Control de opciones de un bloque de análisis (se muestra en la zona Vista del riel). */
export function ViewControl<T extends string | number>({ label, value, options, onChange }: ViewControlProps<T>) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <ToggleGroup
                type="single"
                value={String(value)}
                onValueChange={(v) => {
                    const next = options.find((o) => String(o.value) === v)
                    if (next) onChange(next.value)
                }}
                aria-label={label}
                className="flex-wrap justify-start gap-1"
            >
                {options.map((o) => (
                    <ToggleGroupItem
                        key={String(o.value)}
                        value={String(o.value)}
                        size="sm"
                        className="text-3xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        {o.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    )
}
