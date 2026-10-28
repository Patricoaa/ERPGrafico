"use client"

import { Eye, Pencil, RotateCcw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StepCapabilities } from "../types"
import type { WorkOrderStage } from "../types"

interface WizardStageNoticeProps {
    /** The stage being displayed. */
    stage: WorkOrderStage
    /** True when this is the stage the order is currently in. */
    isCurrent: boolean
    /** The order is finished or cancelled: nothing can be reopened. */
    isTerminal: boolean
    /** Only present for past stages. */
    capabilities?: StepCapabilities
    /** The step's own controls are live (materials / services still adjustable). */
    editableInline: boolean
    onReopen: () => void
    className?: string
}

/**
 * Unified step header: renders for every workflow stage (past, current, terminal).
 * The right side carries the mode badge/action appropriate to the step's state.
 */
export function WizardStageNotice({
    stage, isCurrent, isTerminal, capabilities, editableInline, onReopen, className,
}: WizardStageNoticeProps) {
    const StageIcon = stage.icon

    // ── right-side badge / action ──────────────────────────────────────────────
    let modeNode: React.ReactNode

    if (isTerminal) {
        modeNode = (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" aria-hidden />
                Solo lectura
            </span>
        )
    } else if (isCurrent) {
        modeNode = (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" aria-hidden />
                Activa
            </span>
        )
    } else if (capabilities?.canEdit) {
        // Past stage that allows inline edits — show badge and optionally reopen
        modeNode = (
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                    <Pencil className="h-3 w-3" aria-hidden />
                    Editable
                </span>
                {capabilities.canRewind && (
                    <Button type="button" variant="outline" size="sm" onClick={onReopen} className="h-7 gap-1.5 text-xs">
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Reabrir
                    </Button>
                )}
            </div>
        )
    } else if (capabilities?.canRewind) {
        modeNode = (
            <Button type="button" variant="outline" size="sm" onClick={onReopen} className="h-7 gap-1.5 text-xs">
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reabrir etapa
            </Button>
        )
    } else {
        // Past + read-only + no rewind
        modeNode = (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" aria-hidden />
                Solo lectura
            </span>
        )
    }

    return (
        <div
            role="banner"
            className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-xs",
                isCurrent && "border-primary/20",
                !isCurrent && "border-border/50 bg-muted/30",
                className,
            )}
        >
            {StageIcon && (
                <StageIcon
                    className={cn(
                        "h-4 w-4 shrink-0",
                        isCurrent ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                />
            )}
            <div className="min-w-0 flex-1">
                <p className={cn(
                    "text-sm font-semibold leading-tight",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                )}>
                    {stage.label}
                </p>
                {!isCurrent && !isTerminal && capabilities?.rewindBlockedReason && !capabilities.canRewind && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{capabilities.rewindBlockedReason}</p>
                )}
                {!isCurrent && editableInline && capabilities?.canEdit && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Puedes ajustar sus datos sin reabrir la etapa.</p>
                )}
            </div>
            <div className="shrink-0">
                {modeNode}
            </div>
        </div>
    )
}
