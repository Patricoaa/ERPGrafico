"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardLead } from "./CardLead"
import { cn } from "@/lib/utils"
import { useTouchMode } from "@/hooks/useTouchMode"

export type ApprovalBannerState = 'required' | 'waiting' | 'approved' | 'rejected'

export interface ApprovalContextItem {
    label: string
    value: string
}

const STATE_CONFIG: Record<ApprovalBannerState, {
    title: string
    leadClass: string
    icon: LucideIcon
    iconClass?: string
}> = {
    required: {
        title: "Autorización Requerida",
        leadClass: "bg-warning/10 text-warning",
        icon: AlertCircle,
    },
    waiting: {
        title: "Esperando Autorización…",
        leadClass: "bg-info/10 text-info",
        icon: Loader2,
        iconClass: "animate-spin motion-reduce:animate-none",
    },
    approved: {
        title: "Autorización Concedida",
        leadClass: "bg-success/10 text-success",
        icon: CheckCircle2,
    },
    rejected: {
        title: "Solicitud Rechazada",
        leadClass: "bg-destructive/10 text-destructive",
        icon: XCircle,
    },
}

export interface ApprovalRequestBannerProps {
    state: ApprovalBannerState
    /** Override default title for this state */
    title?: string
    description?: string | null
    context?: ApprovalContextItem[]
    canDirectApprove?: boolean
    approvalTaskId?: number | null
    onAdjust?: () => void
    onDirectApprove?: () => void
    onRequest?: () => void
    onCancel?: () => void
    onVerify?: () => void
    className?: string
}

/**
 * Reusable approval-state banner. Covers all stages of an approval workflow:
 * required → waiting → approved / rejected. Used in POS checkout wizard and
 * wherever an OT step or other process requires external sign-off.
 */
export function ApprovalRequestBanner({
    state,
    title: titleOverride,
    description,
    context = [],
    canDirectApprove = false,
    approvalTaskId,
    onAdjust,
    onDirectApprove,
    onRequest,
    onCancel,
    onVerify,
    className,
}: ApprovalRequestBannerProps) {
    const { isTouchMode } = useTouchMode()
    const { title: defaultTitle, leadClass, icon: Icon, iconClass } = STATE_CONFIG[state]
    const title = titleOverride ?? defaultTitle

    const btnH = isTouchMode ? "h-11 text-sm" : "h-9 text-xs"
    const btnBase = "rounded-sm font-medium uppercase tracking-tight"

    const hasActions = state === 'waiting' || state === 'required'

    return (
        <div
            role="status"
            className={cn("surface-item flex gap-3 p-4", className)}
        >
            <CardLead className={cn("h-10 shrink-0", leadClass)}>
                <Icon className={cn("size-5", iconClass)} aria-hidden />
            </CardLead>

            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-tight text-foreground">{title}</p>

                {description && (
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                )}

                {context.length > 0 && (
                    <dl className={cn(
                        "flex flex-wrap gap-x-4 gap-y-0.5 text-xs",
                        description ? "mt-2 pt-1.5 border-t border-border/40" : "mt-1",
                    )}>
                        {context.map(({ label, value }) => (
                            <div key={label} className="flex items-baseline gap-1">
                                <dt className="text-muted-foreground/70 font-medium">{label}:</dt>
                                <dd className="text-foreground/80">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}

                {hasActions && (
                    <div className={cn("flex items-center flex-wrap gap-2 mt-3", isTouchMode && "gap-3")}>
                        {state === 'waiting' ? (
                            <>
                                {onCancel && (
                                    <Button variant="outline" onClick={onCancel} className={cn(btnBase, btnH)}>
                                        Cancelar
                                    </Button>
                                )}
                                {approvalTaskId && onVerify && (
                                    <Button
                                        variant="outline"
                                        onClick={onVerify}
                                        className={cn(btnBase, "border-border/60 shadow-card", btnH)}
                                    >
                                        Verificar
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                {onAdjust && (
                                    <Button
                                        variant="outline"
                                        onClick={onAdjust}
                                        className={cn(btnBase, "border-border/60 shadow-card", btnH)}
                                    >
                                        Ajustar
                                    </Button>
                                )}
                                {canDirectApprove && onDirectApprove && (
                                    <Button
                                        onClick={onDirectApprove}
                                        className={cn(btnBase, "bg-primary hover:bg-primary/90 text-primary-foreground border-none", btnH)}
                                    >
                                        Aprobar
                                    </Button>
                                )}
                                {onRequest && (
                                    <Button
                                        variant="outline"
                                        onClick={onRequest}
                                        className={cn(btnBase, "border-border/60 shadow-card", btnH)}
                                    >
                                        Solicitar
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
