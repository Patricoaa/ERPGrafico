"use client"

import { Eye, Pencil, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { StepCapabilities } from "../types"

interface WizardStageActionsProps {
    /** The order is finished or cancelled: nothing can be edited or reopened. */
    isTerminal: boolean
    capabilities: StepCapabilities
    /** The stage's own controls are live (materials / services being adjusted). */
    editing: boolean
    onEditingChange: (editing: boolean) => void
    onReopen: () => void
}

const SEGMENT = "h-7 gap-1.5 rounded-sm px-2.5 text-xs"

/**
 * Actions of a closed stage, in the step header: view (read-only) / edit, and reopen.
 * Edit is shown blocked with its reason when the stage can't be changed; reopen only
 * appears while it is still possible.
 */
export function WizardStageActions({ isTerminal, capabilities, editing, onEditingChange, onReopen }: WizardStageActionsProps) {
    const canEdit = !isTerminal && capabilities.canEdit
    const editBlockedReason = isTerminal
        ? "La orden está cerrada."
        : capabilities.editBlockedReason ?? "Esta etapa ya no se puede modificar."
    const canReopen = !isTerminal && capabilities.canRewind

    const editButton = (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canEdit}
            aria-pressed={editing}
            onClick={() => onEditingChange(true)}
            className={cn(SEGMENT, editing && "bg-background text-foreground shadow-sm")}
        >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Editar
        </Button>
    )

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
                <div role="group" aria-label="Modo de la etapa" className="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={!editing}
                        onClick={() => onEditingChange(false)}
                        className={cn(SEGMENT, !editing && "bg-background text-foreground shadow-sm")}
                    >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Solo lectura
                    </Button>
                    {canEdit ? editButton : (
                        <Tooltip>
                            {/* A disabled button gets no pointer events: the wrapper carries the tooltip. */}
                            <TooltipTrigger asChild>
                                <span tabIndex={0} aria-label={`Editar no disponible: ${editBlockedReason}`}>{editButton}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">{editBlockedReason}</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                {canReopen && (
                    <Button type="button" variant="outline" size="sm" onClick={onReopen} className="h-8 gap-1.5 text-xs">
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Reabrir etapa
                    </Button>
                )}
            </div>
        </TooltipProvider>
    )
}
