"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { CreditContact, CreditHistoryEntry } from "@/features/credits/api/creditsApi"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

const fmt = (v: string | number | undefined) =>
    Number(v || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

export const getPortfolioColumns = (onEdit: (c: CreditContact) => void): ColumnDef<CreditContact>[] => [
    {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => {
            const contact = row.original
            return (
                <DataCell.ContactLink contactId={contact.id}>
                    {contact.name}
                    {contact.credit_auto_blocked && <AlertCircle className="h-3 w-3 text-warning ml-2" />}
                </DataCell.ContactLink>
            )
        },
    },
    {
        accessorKey: "credit_risk_level",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Riesgo" className="justify-center" />,
        cell: ({ row }) => {
            const risk = row.original.credit_risk_level
            const color = risk === 'LOW' ? 'text-success' :
                risk === 'MEDIUM' ? 'text-warning' :
                    risk === 'HIGH' ? 'text-warning' : 'text-destructive'
            const label = risk === 'LOW' ? 'Bajo' :
                risk === 'MEDIUM' ? 'Medio' :
                    risk === 'HIGH' ? 'Alto' : 'Crítico'

            return (
                <DataCell.Text className={cn("font-black uppercase tracking-tighter text-[11px]", color)}>
                    {label}
                </DataCell.Text>
            )
        }
    },
    {
        accessorKey: "credit_limit",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Límite" className="justify-center" />,
        cell: ({ row }) => {
            const contact = row.original
            const limit = Number(contact.credit_limit || 0)
            return (
                <div className="flex justify-center w-full" onClick={(e) => { e.stopPropagation(); onEdit(contact); }}>
                    <DataCell.Currency value={limit} className="font-bold cursor-pointer hover:underline text-primary" />
                </div>
            )
        },
    },
    {
        accessorKey: "credit_balance_used",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Utilizado" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.credit_balance_used} className="text-info font-black" />
            </div>
        ),
    },
    {
        id: "current",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Vigente" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.credit_aging.current} className="text-success" />
            </div>
        ),
    },
    {
        id: "overdue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="En Mora" className="justify-center text-destructive" />,
        cell: ({ row }) => {
            const aging = row.original.credit_aging
            const val = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus)
            return (
                <div className="flex justify-center w-full">
                    <div className={cn("text-center text-[12px] font-mono", val > 0 ? "text-destructive font-black" : "")}>{val > 0 ? fmt(val) : <span className="text-muted-foreground/30">—</span>}</div>
                </div>
            )
        },
    },
    {
        id: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
        accessorFn: (row) => {
            const hasOverdue = Number(row.credit_aging.overdue_30) + Number(row.credit_aging.overdue_60) + Number(row.credit_aging.overdue_90) + Number(row.credit_aging.overdue_90plus) > 0
            if (row.credit_blocked) return "Bloqueado"
            if (row.credit_auto_blocked) return "Auto-Bloqueo"
            if (hasOverdue) return "En mora"
            if (Number(row.credit_balance_used) > 0) return "Activo"
            return "Al día"
        },
        cell: ({ row }) => {
            const contact = row.original
            const totalDebt = Number(contact.credit_balance_used)
            const aging = contact.credit_aging
            const hasOverdue = Number(aging.overdue_30) + Number(aging.overdue_60) + Number(aging.overdue_90) + Number(aging.overdue_90plus) > 0

            const statusKey = contact.credit_blocked ? "ERROR" :
                contact.credit_auto_blocked ? "WARNING" :
                    hasOverdue ? "WARNING" :
                        totalDebt > 0 ? "INFO" : "SUCCESS";
            const label = contact.credit_blocked ? "Bloqueado" :
                contact.credit_auto_blocked ? "Auto-Bloqueo" :
                    hasOverdue ? "En mora" :
                        totalDebt > 0 ? "Activo" : "Al día";

            return (
                <div className="flex justify-center w-full">
                    <StatusBadge variant="default" status={statusKey} label={label} />
                </div>
            )
        },
    },
]

export const historyColumns: ColumnDef<CreditHistoryEntry>[] = [
    {
        accessorKey: "date",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Date value={row.original.date} />
            </div>
        )
    },
    {
        accessorKey: "customer_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
        cell: ({ row }) => {
            const h = row.original
            return (
                <DataCell.ContactLink contactId={h.customer_id}>
                    {h.customer_name}
                </DataCell.ContactLink>
            )
        }
    },
    {
        accessorKey: "number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Nota Venta" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Code>NV-{row.original.number}</DataCell.Code>
            </div>
        )
    },
    {
        accessorKey: "effective_total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <DataCell.Currency value={row.original.effective_total} className="font-black" />
            </div>
        )
    },
    {
        accessorKey: "credit_assignment_origin",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Origen" className="justify-center" />,
        cell: ({ row }) => (
            <div className="flex justify-center w-full">
                <StatusBadge
                    variant="default"
                    status={`ORIGIN_${row.original.credit_assignment_origin}`}
                    label={row.original.credit_assignment_origin_display}
                />
            </div>
        )
    },
]
