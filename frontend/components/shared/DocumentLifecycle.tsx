"use client"

import type { LucideIcon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { stageIntent } from "@/lib/workflow-status"
import { StatusBadge } from "./StatusBadge"

/**
 * Franja de ciclo de la ficha documental (ADR-0083, contrato component-document-sheet.md §3).
 * Reemplaza HubStatus del Order Hub. Solo pasos: los importes viven en el Resumen (no se
 * repiten aquí). Solo presentación: el consumidor calcula los pasos con el estado del documento.
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

export interface DocumentLifecycleProps {
    steps: LifecycleStep[]
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

export function DocumentLifecycle({ steps, onStepClick, activeStepId, className }: DocumentLifecycleProps) {
    const visible = steps.filter((step) => step.status !== "not_applicable")
    if (visible.length === 0) return null

    return (
        <TooltipProvider delayDuration={150}>
            <div className={className}>
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
                                        intent={stageIntent(step.status)}
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
            </div>
        </TooltipProvider>
    )
}
