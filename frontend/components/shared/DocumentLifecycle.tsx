"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./StatusBadge"

/**
 * Franja de ciclo de la ficha documental (ADR-0083, contrato component-document-sheet.md §3).
 * Reemplaza HubStatus + OrderHeaderDashboard del Order Hub. Solo presentación: el consumidor
 * calcula los pasos (estado del propio documento) y las cifras.
 */
export type LifecycleStepStatus = "success" | "active" | "neutral" | "destructive" | "not_applicable"

export interface LifecycleStep {
    id: string
    label: string
    icon: LucideIcon
    status: LifecycleStepStatus
    /** 0–100; dibuja el anillo de avance del StatusBadge. */
    progress?: number
    /** Texto corto bajo el nombre del paso ("2 de 3 despachados"). */
    detail?: string
}

export interface LifecycleFigure {
    label: string
    value: ReactNode
}

export interface DocumentLifecycleProps {
    steps: LifecycleStep[]
    figures?: LifecycleFigure[]
    /** Al pulsar un paso (p. ej. abrir Relaciones filtrado por esa área). */
    onStepClick?: (stepId: string) => void
    activeStepId?: string | null
    className?: string
}

const STEP_LABEL: Record<LifecycleStepStatus, string> = {
    success: "Completado",
    active: "En curso",
    neutral: "Pendiente",
    destructive: "Anulado",
    not_applicable: "No aplica",
}

export function DocumentLifecycle({ steps, figures, onStepClick, activeStepId, className }: DocumentLifecycleProps) {
    const visible = steps.filter((step) => step.status !== "not_applicable")
    if (visible.length === 0 && !figures?.length) return null

    return (
        <TooltipProvider delayDuration={150}>
            <div className={cn("space-y-3", className)}>
                {visible.length > 0 && (
                    <ol className="flex items-start" aria-label="Ciclo del documento">
                        {visible.map((step, index) => {
                            const isActive = activeStepId === step.id
                            const content = (
                                <>
                                    <StatusBadge
                                        variant="hub"
                                        size="md"
                                        icon={step.icon}
                                        status={step.status}
                                        progress={step.progress}
                                        tooltip={`${step.label}: ${step.detail ?? STEP_LABEL[step.status]}`}
                                    />
                                    <span className="min-w-0 text-left">
                                        <span className={cn(
                                            "block truncate text-3xs font-bold uppercase tracking-widest",
                                            isActive ? "text-foreground" : "text-muted-foreground",
                                        )}>
                                            {step.label}
                                        </span>
                                        <span className="block truncate text-3xs text-muted-foreground">
                                            {step.detail ?? STEP_LABEL[step.status]}
                                        </span>
                                    </span>
                                </>
                            )
                            return (
                                <li key={step.id} className="flex min-w-0 flex-1 items-center">
                                    {onStepClick ? (
                                        <button
                                            type="button"
                                            onClick={() => onStepClick(step.id)}
                                            aria-pressed={isActive}
                                            className={cn(
                                                "flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
                                                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                isActive && "bg-muted",
                                            )}
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <div className="flex min-w-0 items-center gap-2 px-1.5 py-1">{content}</div>
                                    )}
                                    {index < visible.length - 1 && (
                                        <span aria-hidden className="mx-1 h-px min-w-3 flex-1 bg-border" />
                                    )}
                                </li>
                            )
                        })}
                    </ol>
                )}
                {figures && figures.length > 0 && (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                        {figures.map((figure) => (
                            <div key={figure.label} className="min-w-0">
                                <dt className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">{figure.label}</dt>
                                <dd className="truncate text-sm font-medium tabular-nums">{figure.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </TooltipProvider>
    )
}
