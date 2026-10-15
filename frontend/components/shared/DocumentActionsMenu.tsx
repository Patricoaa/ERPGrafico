"use client"

import { MoreVertical, Printer, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Menú único de acciones de la ficha documental (ADR-0083, component-document-sheet.md §4).
 * Botón de cabecera del Drawer con el mismo lenguaje que el de cierre (circular, ghost, tooltip)
 * y menú con el estilo de `DataCell.ActionMenu`. Orden: siguiente paso del ciclo, demás
 * acciones, imprimir y, separadas al final, las destructivas. Un punto cian indica que hay un
 * siguiente paso pendiente. Solo presentación: el consumidor resuelve disponibilidad y permisos.
 */
export interface DocumentActionItem {
    id: string
    label: string
    icon?: LucideIcon
    onClick: () => void
    disabled?: boolean
    /** Motivo visible bajo la acción cuando `disabled`. */
    disabledReason?: string
    /** Anular, cancelar…: siempre al final, separadas. */
    destructive?: boolean
}

export interface DocumentActionsMenuProps {
    /** Siguiente paso del ciclo; se destaca primero. */
    primary?: DocumentActionItem | null
    actions?: DocumentActionItem[]
    onPrint?: () => void
    label?: string
}

export function DocumentActionsMenu({ primary, actions = [], onPrint, label = "Acciones" }: DocumentActionsMenuProps) {
    const regular = actions.filter((a) => !a.destructive && a.id !== primary?.id)
    const destructive = actions.filter((a) => a.destructive)
    if (!primary && regular.length === 0 && destructive.length === 0 && !onPrint) return null

    const groups = [
        primary ? [<DropdownMenuLabel key="next" className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Siguiente paso</DropdownMenuLabel>, <Item key={primary.id} action={primary} emphasis />] : [],
        regular.map((action) => <Item key={action.id} action={action} />),
        onPrint ? [<Item key="print" action={{ id: "print", label: "Imprimir", icon: Printer, onClick: onPrint }} />] : [],
        destructive.map((action) => <Item key={action.id} action={action} />),
    ].filter((group) => group.length > 0)

    return (
        <TooltipProvider delayDuration={400}>
            <Tooltip>
                <DropdownMenu>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={label}
                                className="relative h-8 w-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95 data-[state=open]:bg-muted data-[state=open]:text-foreground"
                            >
                                <MoreVertical className="h-4 w-4" />
                                {primary && (
                                    <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <DropdownMenuContent align="end" className="rounded-lg border-sidebar-border min-w-60">
                        {groups.map((group, index) => (
                            <div key={index}>
                                {index > 0 && <DropdownMenuSeparator />}
                                {group}
                            </div>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="bottom" className="text-xs font-semibold uppercase tracking-looser px-2 py-1 shadow-floating rounded-sm">
                    {primary ? `${label} · ${primary.label}` : label}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function Item({ action, emphasis = false }: { action: DocumentActionItem; emphasis?: boolean }) {
    const Icon = action.icon
    return (
        <DropdownMenuItem
            onClick={action.onClick}
            disabled={action.disabled}
            variant={action.destructive ? "destructive" : "default"}
            className={cn(
                "text-xs font-semibold uppercase tracking-widest rounded-sm cursor-pointer items-start",
                emphasis && "text-cyan focus:text-cyan",
            )}
        >
            {Icon && <Icon className="mt-0.5 h-3.5 w-3.5" />}
            <span className="flex flex-col gap-0.5">
                <span>{action.label}</span>
                {action.disabled && action.disabledReason && (
                    <span className="text-3xs font-medium normal-case tracking-normal text-muted-foreground">{action.disabledReason}</span>
                )}
            </span>
        </DropdownMenuItem>
    )
}
