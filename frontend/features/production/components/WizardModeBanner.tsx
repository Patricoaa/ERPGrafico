"use client"

import { Eye, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WizardStepMode } from "../types"

interface WizardModeBannerProps {
    mode: WizardStepMode
    isViewingCurrentStage: boolean
    className?: string
}

/**
 * Renders a contextual banner when the user is viewing or editing a past (closed) step.
 * Hidden when the user is at the current active stage.
 * Rewind mode has no banner — the confirmation modal handles that flow.
 */
export function WizardModeBanner({ mode, isViewingCurrentStage, className }: WizardModeBannerProps) {
    if (isViewingCurrentStage || mode === 'rewind') return null

    if (mode === 'view') {
        return (
            <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium",
                "bg-muted/60 text-muted-foreground border border-border/50",
                className
            )}>
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>Modo lectura · Etapa cerrada</span>
            </div>
        )
    }

    if (mode === 'edit-in-place') {
        return (
            <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium",
                "bg-info/10 text-info border border-info/20",
                className
            )}>
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span>Editando datos de etapa cerrada · los cambios no avanzan la OT</span>
            </div>
        )
    }

    return null
}
