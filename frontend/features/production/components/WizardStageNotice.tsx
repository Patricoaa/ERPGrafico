"use client"

import { Eye, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StepCapabilities } from "../types"

interface WizardStageNoticeProps {
    /** The order is finished or cancelled: nothing can be reopened. */
    isTerminal: boolean
    capabilities: StepCapabilities
    /** The step's own controls are live (materials / services still adjustable). */
    editableInline: boolean
    onReopen: () => void
    className?: string
}

/**
 * Single entry point for acting on a closed stage.
 *
 * Replaces the view / edit / rewind modes: a closed stage is read-only, and the
 * only thing the operator can do to it is reopen it. Whatever blocks that is
 * written next to the button, never hidden in a tooltip.
 */
export function WizardStageNotice({ isTerminal, capabilities, editableInline, onReopen, className }: WizardStageNoticeProps) {
    const description = isTerminal
        ? "Orden cerrada · solo lectura"
        : editableInline
            ? "Etapa cerrada · puedes ajustar sus datos"
            : "Etapa cerrada · solo lectura"

    return (
        <div
            role="status"
            className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/50 bg-muted/60 px-3 py-2",
                className,
            )}
        >
            <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{description}</p>
                {!isTerminal && !capabilities.canRewind && capabilities.rewindBlockedReason && (
                    <p className="text-xs text-muted-foreground">No se puede reabrir. {capabilities.rewindBlockedReason}</p>
                )}
            </div>
            {!isTerminal && (
                <Button type="button" variant="outline" size="sm" disabled={!capabilities.canRewind} onClick={onReopen} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reabrir etapa
                </Button>
            )}
        </div>
    )
}
