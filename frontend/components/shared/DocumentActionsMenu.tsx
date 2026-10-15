"use client"

import { ChevronDown, Printer, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Menú único de acciones de la ficha documental (ADR-0083, component-document-sheet.md §4).
 * Va en la cabecera del Drawer, junto al botón de cierre. Orden: siguiente paso del ciclo,
 * demás acciones, imprimir y, al final y separadas, las destructivas.
 * Solo presentación: el consumidor resuelve disponibilidad y permisos.
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="active:scale-[0.98]">
                    {label}
                    <ChevronDown />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
                {groups.map((group, index) => (
                    <div key={index}>
                        {index > 0 && <DropdownMenuSeparator />}
                        {group}
                    </div>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function Item({ action, emphasis = false }: { action: DocumentActionItem; emphasis?: boolean }) {
    const Icon = action.icon
    return (
        <DropdownMenuItem
            onClick={action.onClick}
            disabled={action.disabled}
            variant={action.destructive ? "destructive" : "default"}
            className={emphasis ? "font-semibold" : undefined}
        >
            {Icon && <Icon />}
            <span className="flex flex-col">
                <span>{action.label}</span>
                {action.disabled && action.disabledReason && (
                    <span className="text-3xs font-normal text-muted-foreground">{action.disabledReason}</span>
                )}
            </span>
        </DropdownMenuItem>
    )
}
