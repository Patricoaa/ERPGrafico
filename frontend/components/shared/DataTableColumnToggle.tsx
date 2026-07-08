"use client"

import React from "react"
import { Check, Columns3 } from "lucide-react"
import { type Table } from "@tanstack/react-table"

import { TOOLBAR_MENU_ITEM, TOOLBAR_ICON_BTN, SEG_CHECKBOX } from './SegmentationBar/styles'
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
                            className={TOOLBAR_ICON_BTN}
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
                                TOOLBAR_MENU_ITEM,
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
                                    SEG_CHECKBOX + " border-primary/50",
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
