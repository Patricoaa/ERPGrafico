"use client"

import { useState, useEffect } from "react"
import { usePosTerminals } from "@/features/sales"
import type { Terminal } from "@/features/treasury"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { ActionConfirmModal, DataTableView, EntityCard, IconButton, StatusBadge } from '@/components/shared'
import { Badge } from "@/components/ui/badge"

import { DataTableColumnHeader } from '@/components/shared'
import {createActionsColumn, DataCell} from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Power, PowerOff, Trash2, Settings, MapPin, Smartphone, Banknote, CreditCard, Landmark, FileCheck, MoreHorizontal } from "lucide-react"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { PosTerminalDrawer } from "./PosTerminalDrawer"

const PAYMENT_TYPE_ORDER = ['CASH', 'CARD', 'CARD_TERMINAL', 'TRANSFER', 'CHECK', 'OTHER'] as const

type PaymentTypeMeta = {
    label: string
    Icon: typeof Banknote
    iconColorClass: string
    badgeVariant: "default" | "secondary" | "info" | "warning" | "success" | "outline"
}

const PAYMENT_TYPE_META: Record<string, PaymentTypeMeta> = {
    CASH: {
        label: "Efectivo",
        Icon: Banknote,
        iconColorClass: "text-success",
        badgeVariant: "outline",
    },
    CARD: {
        label: "Tarjeta",
        Icon: CreditCard,
        iconColorClass: "text-info",
        badgeVariant: "outline",
    },
    CARD_TERMINAL: {
        label: "Terminal",
        Icon: Smartphone,
        iconColorClass: "text-primary",
        badgeVariant: "outline",
    },
    TRANSFER: {
        label: "Transferencia",
        Icon: Landmark,
        iconColorClass: "text-primary",
        badgeVariant: "outline",
    },
    CHECK: {
        label: "Cheque",
        Icon: FileCheck,
        iconColorClass: "text-warning",
        badgeVariant: "outline",
    },
    OTHER: {
        label: "Otros",
        Icon: MoreHorizontal,
        iconColorClass: "text-muted-foreground",
        badgeVariant: "outline",
    },
}

interface PosTerminalListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function PosTerminalList({ externalOpen, onExternalOpenChange, createAction }: PosTerminalListProps) {
    const { terminals, toggleActive, deleteTerminal, refetch, isLoading } = usePosTerminals()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null)

    const handleEdit = (terminal: Terminal) => {
        setEditingTerminal(terminal)
        setDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingTerminal(null)
        setDialogOpen(true)
        onExternalOpenChange?.(false)
    }

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => handleCreate())
        }
    }, [externalOpen])

    const handleToggleActive = async (terminal: Terminal) => {
        try {
            await toggleActive(terminal)
        } catch {
            // Error already handled by hook
        }
    }

    const deleteConfirm = useConfirmAction<Terminal>(async (terminal: Terminal) => {
        try {
            await deleteTerminal(terminal)
        } catch {
            // Error already handled by hook
        }
    })

    const handleDelete = (terminal: Terminal) => {
        deleteConfirm.requestConfirm(terminal)
    }

    const columns: ColumnDef<Terminal>[] = [
        {
            accessorKey: "code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Code>{row.getValue("code")}</DataCell.Code></div>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("name")}</DataCell.Text>,
        },
        {
            accessorKey: "location",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" className="justify-center" />,
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("location")}</DataCell.Secondary>,
        },
        {
            accessorKey: "is_active",
            id: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Status status={row.original.is_active ? "active" : "inactive"} />
            ),
            filterFn: (row, id, value) => value.includes(row.getValue(id) ? "ACTIVE" : "INACTIVE")
        },
        createActionsColumn<Terminal>({
            renderActions: (terminal) => (
                <>
                    <DataCell.Action
                        icon={Settings}
                        title="Editar"
                        onClick={() => handleEdit(terminal)}
                    />
                    <DataCell.Action
                        icon={terminal.is_active ? PowerOff : Power}
                        title={terminal.is_active ? "Desactivar" : "Activar"}
                        className={terminal.is_active ? "text-muted-foreground hover:text-destructive" : ""}
                        onClick={() => handleToggleActive(terminal)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(terminal)}
                    />
                </>
            )
        })
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.terminal"
                    columns={columns}
                    data={terminals}
                    isLoading={isLoading}
                    variant="embedded"
                    defaultPageSize={20}
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Activas", value: "ACTIVE" },
                                { label: "Inactivas", value: "INACTIVE" }
                            ]
                        }
                    ]}
                    createAction={createAction || (
                        <Button onClick={handleCreate} className="h-9">
                            <Plus className="mr-2 h-4 w-4" /> Crear Caja
                        </Button>
                    )}
                    renderCard={(terminal: Terminal) => {
                        const methodsByType = terminal.allowed_payment_methods.reduce((acc, method) => {
                            let type = method.method_type
                            if (type === 'DEBIT_CARD' || type === 'CREDIT_CARD') {
                                type = 'CARD'
                            }
                            if (!acc[type]) acc[type] = 0
                            acc[type]++
                            return acc
                        }, {} as Record<string, number>)

                        const orderedTypes = PAYMENT_TYPE_ORDER.filter(t => methodsByType[t] !== undefined)
                        const totalMethods = Object.values(methodsByType).reduce((a, b) => a + b, 0)

                        return (
                            <EntityCard key={terminal.id} className={!terminal.is_active ? "opacity-70 bg-muted/20" : ""}>
                                <EntityCard.Header
                                    title={terminal.name}
                                    subtitle={terminal.code}
                                    trailing={
                                        <div className="flex flex-col items-end gap-2">
                                            <StatusBadge status={terminal.is_active ? "active" : "inactive"} size="sm" className="uppercase font-bold tracking-tight" />
                                            <div className="flex items-center gap-1">
                                                <IconButton onClick={() => handleEdit(terminal)} className="h-7 w-7"><Settings className="h-3 w-3" /></IconButton>
                                            </div>
                                        </div>
                                    }
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field
                                        label="Ubicación"
                                        value={
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {terminal.location || "No especificada"}
                                            </div>
                                        }
                                    />
                                    {terminal.payment_terminal_device && (
                                        <EntityCard.Field
                                            label="Dispositivo"
                                            value={
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary px-1.5 py-0.5 bg-primary/5 border border-primary/10 rounded uppercase">
                                                    <Smartphone className="h-3 w-3" />
                                                    {terminal.payment_terminal_device_name || "Vinculado"}
                                                </div>
                                            }
                                        />
                                    )}
                                </EntityCard.Body>
                                <EntityCard.Footer className="justify-between items-center bg-muted/10 px-4 py-2 border-t gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {orderedTypes.map(type => {
                                            const meta = PAYMENT_TYPE_META[type]
                                            const Icon = meta.Icon
                                            return (
                                                <Badge
                                                    key={type}
                                                    variant={meta.badgeVariant}
                                                    className="h-5 gap-1 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide"
                                                >
                                                    <Icon className={cn("h-3 w-3", meta.iconColorClass)} />
                                                    {meta.label}
                                                </Badge>
                                            )
                                        })}
                                        {totalMethods === 0 && (
                                            <span className="text-[10px] text-muted-foreground italic">Sin métodos configurados</span>
                                        )}
                                    </div>
                                    {totalMethods > 0 && (
                                        <span className="text-[10px] font-semibold text-muted-foreground/70 whitespace-nowrap">
                                            {totalMethods} {totalMethods === 1 ? "método" : "métodos"}
                                        </span>
                                    )}
                                </EntityCard.Footer>
                            </EntityCard>
                        )
                    }}
                />
            </div>

            <PosTerminalDrawer
                open={dialogOpen}
                onOpenChange={(open: boolean) => {
                    setDialogOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                terminal={editingTerminal}
                onSuccess={refetch}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open: boolean) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Caja POS"
                description={`¿Está seguro de eliminar la caja POS "${deleteConfirm.payload?.name || ''}"? Esta acción no se puede deshacer.`}
                variant="destructive"
            />
        </div>
    )
}

export default PosTerminalList
