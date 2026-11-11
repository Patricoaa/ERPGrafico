"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface POSStepperStep {
    id: string | number
    label: string
    /** Lo elegido en un paso ya hecho (cliente, documento…). Se muestra bajo la etiqueta. */
    meta?: string | null
}

interface POSStepperProps {
    steps: POSStepperStep[]
    /** Índice (0-based) del paso actual. */
    current: number
    label: string
    className?: string
}

/**
 * Progreso de un flujo del POS (venta, apertura, cierre) con un solo lenguaje: círculo numerado,
 * check en los pasos hechos y K100 en el actual. Solo el paso actual lleva etiqueta salvo en pantallas
 * muy anchas; en pantallas angostas se resume en "Paso n de N".
 */
export function POSStepper({ steps, current, label, className }: POSStepperProps) {
    if (steps.length === 0) return null
    const active = steps[Math.min(Math.max(current, 0), steps.length - 1)]

    return (
        <div className={cn("min-w-0", className)}>
            <p className="truncate text-center text-sm lg:hidden">
                <span className="font-mono font-bold tabular-nums text-muted-foreground">
                    Paso {Math.min(current + 1, steps.length)} de {steps.length}
                </span>
                <span className="font-semibold"> · {active.label}</span>
            </p>

            <ol aria-label={label} className="hidden min-w-0 items-center gap-2 lg:flex">
                {steps.map((step, i) => {
                    const done = i < current
                    const isCurrent = i === current
                    return (
                        <li key={step.id} className="flex min-w-0 items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
                            {i > 0 && <span aria-hidden className={cn("h-px w-4 shrink-0 xl:w-8", done || isCurrent ? "bg-foreground/40" : "bg-border")} />}
                            <span className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold tabular-nums",
                                isCurrent && "border-primary bg-primary text-primary-foreground",
                                done && "border-foreground/40 bg-muted text-foreground",
                                !isCurrent && !done && "border-border text-muted-foreground"
                            )}>
                                {done ? <Check className="size-4" aria-hidden /> : i + 1}
                                <span className="sr-only">{done ? " (hecho)" : ""}</span>
                            </span>
                            <span className={cn("flex-col leading-tight", isCurrent ? "flex shrink-0" : "hidden min-w-0 2xl:flex")}>
                                <span className={cn("whitespace-nowrap text-sm", !isCurrent && "truncate", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                    {step.label}
                                </span>
                                {done && step.meta && (
                                    <span className="max-w-28 truncate text-xs text-muted-foreground">{step.meta}</span>
                                )}
                            </span>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
