"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, CloudOff, Loader2, Pencil, RefreshCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AutoSaveStatus } from "@/hooks/useAutoSaveForm"

export interface AutoSaveStatusBadgeProps {
    status: AutoSaveStatus
    invalidReason?: string | null
    lastSavedAt?: Date | null
    onRetry?: () => void | Promise<void>
    className?: string
}

interface Descriptor {
    label: string
    variant: React.ComponentProps<typeof Badge>["variant"]
    icon: React.ComponentType<{ className?: string }>
    spin?: boolean
}

const STATUS_DESCRIPTORS: Record<AutoSaveStatus, Descriptor> = {
    idle: { label: "Sin cambios", variant: "outline", icon: CheckCircle2 },
    dirty: { label: "Cambios pendientes", variant: "secondary", icon: Pencil },
    saving: { label: "Guardando…", variant: "info", icon: Loader2, spin: true },
    synced: { label: "Guardado", variant: "success", icon: CheckCircle2 },
    invalid: { label: "Cambios sin guardar", variant: "warning", icon: AlertCircle },
    error: { label: "Error al guardar", variant: "destructive", icon: CloudOff },
}

function formatRelativeTime(date: Date): string {
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (seconds < 5) return "ahora"
    if (seconds < 60) return `hace ${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    return `hace ${hours} h`
}

export function AutoSaveStatusBadge({
    status,
    invalidReason,
    lastSavedAt,
    onRetry,
    className,
}: AutoSaveStatusBadgeProps) {
    const descriptor = STATUS_DESCRIPTORS[status]
    const Icon = descriptor.icon

    const showSavedAt = status === "idle" && lastSavedAt
    const tooltipContent =
        status === "invalid"
            ? invalidReason
            : status === "error"
              ? "El último intento falló. Pulsa para reintentar."
              : status === "synced" && lastSavedAt
                ? `Guardado ${formatRelativeTime(lastSavedAt)}`
                : null

    const badge = (
        <Badge
            variant={descriptor.variant}
            className={cn("gap-1.5 font-medium", className)}
            data-status={status}
        >
            <Icon className={cn("h-3 w-3", descriptor.spin && "animate-spin")} />
            <span>
                {showSavedAt ? `Guardado ${formatRelativeTime(lastSavedAt)}` : descriptor.label}
            </span>
        </Badge>
    )

    const content = tooltipContent ? (
        <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    ) : (
        badge
    )

    if (status === "error" && onRetry) {
        return (
            <div className="inline-flex items-center gap-2">
                {content}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void onRetry()}
                >
                    <RefreshCcw className="mr-1 h-3 w-3" />
                    Reintentar
                </Button>
            </div>
        )
    }

    return content
}
