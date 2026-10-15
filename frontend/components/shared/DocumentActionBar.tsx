"use client"

import { MoreHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Barra de acciones de la ficha documental (ADR-0083, component-document-sheet.md §4).
 * Una acción primaria (el siguiente paso del ciclo), hasta 3 secundarias y el resto en "Más".
 * Solo presentación: el consumidor resuelve disponibilidad y permisos.
 */
export interface DocumentActionItem {
    id: string
    label: string
    icon?: LucideIcon
    onClick: () => void
    disabled?: boolean
    /** Motivo mostrado como tooltip cuando `disabled`. */
    disabledReason?: string
    /** Acción destructiva (anular, cancelar): siempre va al menú "Más", separada. */
    destructive?: boolean
}

export interface DocumentActionBarProps {
    primary?: DocumentActionItem | null
    secondary?: DocumentActionItem[]
    overflow?: DocumentActionItem[]
    /** Máximo de secundarias visibles; el excedente pasa a "Más". */
    maxSecondary?: number
    className?: string
}

export function DocumentActionBar({
    primary, secondary = [], overflow = [], maxSecondary = 3, className,
}: DocumentActionBarProps) {
    const regular = secondary.filter((a) => !a.destructive)
    const visible = regular.slice(0, maxSecondary)
    const menu = [...regular.slice(maxSecondary), ...overflow.filter((a) => !a.destructive)]
    const destructive = [...secondary, ...overflow].filter((a) => a.destructive)

    if (!primary && visible.length === 0 && menu.length === 0 && destructive.length === 0) return null

    return (
        <TooltipProvider delayDuration={150}>
            <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="toolbar" aria-label="Acciones del documento">
                {primary && <BarButton action={primary} variant="default" />}
                {visible.map((action) => <BarButton key={action.id} action={action} variant="outline" />)}
                {(menu.length > 0 || destructive.length > 0) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Más acciones">
                                <MoreHorizontal />
                                Más
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-56">
                            {menu.map((action) => <MenuItem key={action.id} action={action} />)}
                            {menu.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
                            {destructive.map((action) => <MenuItem key={action.id} action={action} />)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </TooltipProvider>
    )
}

function BarButton({ action, variant }: { action: DocumentActionItem; variant: "default" | "outline" }) {
    const Icon = action.icon
    const button = (
        <Button
            variant={variant}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="active:scale-[0.98]"
        >
            {Icon && <Icon />}
            {action.label}
        </Button>
    )
    if (!action.disabled || !action.disabledReason) return button
    return (
        <Tooltip>
            {/* span: un botón deshabilitado no emite eventos de puntero */}
            <TooltipTrigger asChild><span tabIndex={0}>{button}</span></TooltipTrigger>
            <TooltipContent>{action.disabledReason}</TooltipContent>
        </Tooltip>
    )
}

function MenuItem({ action }: { action: DocumentActionItem }) {
    const Icon = action.icon
    return (
        <DropdownMenuItem
            onClick={action.onClick}
            disabled={action.disabled}
            variant={action.destructive ? "destructive" : "default"}
            title={action.disabled ? action.disabledReason : undefined}
        >
            {Icon && <Icon />}
            {action.label}
        </DropdownMenuItem>
    )
}
