"use client"

import React from "react"
import { Check, Columns3 } from "lucide-react"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn, translateFieldName } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const COLUMN_BLOCKLIST = new Set([
    "actions", "select", "hub_trigger",
    "production_status", "logistics_status",
    "billing_status", "treasury_status",
])

export function translateColumnId(id: string): string {
    const translations: Record<string, string> = {
        code: "SKU",
        internal_code: "Cód. Interno",
        created_at: "Fec. Creación",
        updated_at: "Últ. Actualización",
        partner_name: "Proveedor/Cliente",
        customer_name: "Cliente",
        supplier_name: "Proveedor",
        contact_name: "Contacto",
        pending_amount: "Mto Pendiente",
        payment_method: "M. de Pago",
        prevision: "Previsión / Salud",
    }
    return translations[id] || translateFieldName(id) || id
}

interface DataTableColumnToggleProps<TData> {
    table: Table<TData>
}

export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                        >
                            <Columns3 className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Columnas</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
                align="end"
                className="w-[220px] p-1 border-border/80 shadow-floating max-h-[60vh] overflow-y-auto"
            >
                {table
                    .getAllColumns()
                    .filter(
                        (column) =>
                            column.getCanHide() &&
                            !COLUMN_BLOCKLIST.has(column.id)
                    )
                    .map((column) => (
                        <div
                            key={column.id}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-[10px] uppercase font-bold tracking-tight outline-none transition-colors",
                                column.getIsVisible()
                                    ? "bg-accent/50 text-primary"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                            onClick={() =>
                                column.toggleVisibility(!column.getIsVisible())
                            }
                        >
                            <div
                                className={cn(
                                    "mr-3 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary/50 transition-all",
                                    column.getIsVisible()
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "opacity-50 [&_svg]:invisible"
                                )}
                            >
                                <Check className="h-3 w-3" />
                            </div>
                            <span>
                                {(column.columnDef.meta as { title?: string })
                                    ?.title || translateColumnId(column.id)}
                            </span>
                        </div>
                    ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
