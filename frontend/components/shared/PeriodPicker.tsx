"use client"

import * as React from "react"
import { CalendarRange, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { periodLabel, samePeriod, type Period, type PeriodPreset } from "@/lib/date-presets"
import { cn } from "@/lib/utils"
import { CommandButton } from "./CommandButton"

/** Registers how to apply the panel's draft, so whoever closes the panel can apply it (collection-toolbar §5.1). */
export type PeriodCommitRef = React.MutableRefObject<(() => void) | null>

export interface PeriodPanelProps {
    /** Applied period. */
    value: Period | null
    presets: readonly PeriodPreset[]
    /** A preset applies at once; Desde/Hasta apply with «Aplicar» or through `commitRef`. `null`: «Quitar». */
    onApply: (period: Period | null) => void
    /** Shows «Quitar». */
    clearable?: boolean
    /** Accessible name of the preset group and the inputs («Fecha», «Período»). */
    label: string
    commitRef?: PeriodCommitRef
}

/**
 * Period body shared by `PeriodPicker` and the list date filter (ADR-0160 §1): presets as radios,
 * Desde/Hasta, and «Quitar» / «Aplicar». A half-filled range applies as a single day.
 */
export function PeriodPanel({ value, presets, onApply, clearable = true, label, commitRef }: PeriodPanelProps) {
    const [from, setFrom] = React.useState(value?.from ?? "")
    const [to, setTo] = React.useState(value?.to ?? "")
    const dirty = from !== (value?.from ?? "") || to !== (value?.to ?? "")

    const apply = React.useCallback(() => {
        if (!dirty) return
        const start = from || to
        if (!start) {
            if (clearable) onApply(null)
            return
        }
        const end = to || start
        onApply(start <= end ? { from: start, to: end } : { from: end, to: start })
    }, [dirty, from, to, clearable, onApply])
    React.useEffect(() => {
        if (!commitRef) return
        commitRef.current = apply
        return () => {
            commitRef.current = null
        }
    }, [commitRef, apply])

    return (
        <div className="flex min-h-48 flex-col">
            {presets.length > 0 && (
                <div role="radiogroup" aria-label={`${label}: períodos`} className="py-1">
                    {presets.map((preset) => {
                        const range = preset.getValue()
                        const checked = samePeriod(range, value)
                        return (
                            <Button
                                key={preset.label}
                                variant="ghost"
                                size="sm"
                                role="radio"
                                aria-checked={checked}
                                onClick={() => {
                                    setFrom(range.from)
                                    setTo(range.to)
                                    onApply(range)
                                }}
                                className={cn("h-control-sm w-full justify-start gap-2 rounded-none px-3 text-xs font-normal", checked && "font-semibold")}
                            >
                                <span className={cn("size-3.5 shrink-0 rounded-full border border-border", checked && "border-4 border-primary")} aria-hidden />
                                {preset.label}
                            </Button>
                        )
                    })}
                </div>
            )}
            <div className={cn("grid grid-cols-2 gap-2 p-3", presets.length > 0 && "border-t border-border/50")}>
                <label className="flex flex-col gap-1 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Desde
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-control-sm font-mono text-xs" aria-label={`${label} desde`} />
                </label>
                <label className="flex flex-col gap-1 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hasta
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-control-sm font-mono text-xs" aria-label={`${label} hasta`} />
                </label>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/50 px-2 py-1.5">
                {clearable ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-control-xs text-xs text-muted-foreground"
                        disabled={!value && !from && !to}
                        onClick={() => {
                            setFrom("")
                            setTo("")
                            onApply(null)
                        }}
                    >
                        Quitar
                    </Button>
                ) : (
                    <span />
                )}
                <Button size="sm" className="h-control-xs text-xs" disabled={!dirty} onClick={apply}>
                    Aplicar
                </Button>
            </div>
        </div>
    )
}

export interface PeriodPickerProps {
    /** Control name: tooltip and accessible name («Período: Este mes»). */
    name: string
    value: Period | null
    onChange: (period: Period | null) => void
    presets?: readonly PeriodPreset[]
    /** «Quitar» in the panel (default true). */
    clearable?: boolean
    icon?: LucideIcon
    /** Shown when there is no period (default: icon only). */
    placeholder?: string
    align?: "start" | "end"
    className?: string
}

/**
 * The one period control (ADR-0160): a command button with the chosen period and a popover with
 * presets and Desde/Hasta. Closing applies the draft; Esc discards it.
 */
export function PeriodPicker({ name, value, onChange, presets = [], clearable = true, icon = CalendarRange, placeholder, align = "start", className }: PeriodPickerProps) {
    const [open, setOpen] = React.useState(false)
    const commitRef: PeriodCommitRef = React.useRef<(() => void) | null>(null)
    const discard = React.useRef(false)

    const onOpenChange = (next: boolean) => {
        if (!next) {
            if (!discard.current) commitRef.current?.()
            discard.current = false
        }
        setOpen(next)
    }
    const apply = (period: Period | null) => {
        commitRef.current = null
        onChange(period)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <CommandButton icon={icon} name={name} value={value ? periodLabel(value, presets) : placeholder} aria-expanded={open} className={className} />
            </PopoverTrigger>
            <PopoverContent
                align={align}
                className="w-64 p-0"
                onEscapeKeyDown={() => {
                    discard.current = true
                }}
            >
                <PeriodPanel value={value} presets={presets} onApply={apply} clearable={clearable} label={name} commitRef={commitRef} />
            </PopoverContent>
        </Popover>
    )
}
