"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTouchMode } from "@/hooks/useTouchMode"
import { Banner, type BannerTone } from "./Banner"
import { cn } from "@/lib/utils"

export type ApprovalBannerState = 'required' | 'waiting' | 'approved' | 'rejected'

export interface ApprovalContextItem {
    label: string
    value: string
}

const STATE_CONFIG: Record<ApprovalBannerState, {
    title: string
    tone: BannerTone
    icon: LucideIcon
    iconClass?: string
}> = {
    required: {
        title: "Autorización requerida",
        tone: "warning",
        icon: AlertCircle,
    },
    waiting: {
        title: "Esperando autorización…",
        tone: "info",
        icon: Loader2,
        iconClass: "animate-spin motion-reduce:animate-none",
    },
    approved: {
        title: "Autorización concedida",
        tone: "success",
        icon: CheckCircle2,
    },
    rejected: {
        title: "Solicitud rechazada",
        tone: "destructive",
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
    const { title: defaultTitle, tone, icon: Icon, iconClass } = STATE_CONFIG[state]
    const title = titleOverride ?? defaultTitle

    const btnH = isTouchMode ? "h-11 text-sm" : "h-9 text-xs"
    const btnBase = "rounded-sm font-medium uppercase tracking-tight"

    const hasActions = state === 'waiting' || state === 'required'

    return (
        <Banner
            tone={tone}
            icon={Icon}
            iconClassName={iconClass}
            title={title}
            className={className}
            actions={hasActions && (
                <>
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
                </>
            )}
        >
            {description && <p>{description}</p>}
            {context.length > 0 && (
                <dl className={cn(
                    "flex flex-wrap gap-x-4 gap-y-0.5 text-xs",
                    description && "mt-1.5",
                )}>
                    {context.map(({ label, value }) => (
                        <div key={label} className="flex items-baseline gap-1">
                            <dt className="font-medium text-muted-foreground/70">{label}:</dt>
                            <dd className="text-foreground/80">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </Banner>
    )
}
