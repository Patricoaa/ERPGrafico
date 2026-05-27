"use client"

import { useState, useEffect } from "react"
import { useTerminals, type Terminal } from "@/features/treasury"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { IconButton } from "@/components/shared"
import { EntityCard } from "@/components/shared/EntityCard"
import { DataTableView } from '@/components/shared/DataTableView'
import { DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell, Chip } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Power, PowerOff, Trash2, Settings, MapPin, Smartphone, Banknote, CreditCard, Landmark } from "lucide-react"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { TerminalDrawer } from "./TerminalDrawer"




interface TerminalManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TerminalManagement({ externalOpen, onExternalOpenChange, createAction }: TerminalManagementProps) {
    const { terminals, toggleActive, deleteTerminal, refetch, isLoading } = useTerminals()
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
        } catch (error) {
            // Error already handled by hook
        }
    }

    const deleteConfirm = useConfirmAction<Terminal>(async (terminal: Terminal) => {
        try {
            await deleteTerminal(terminal)
        } catch (error) {
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
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.terminal"
                    columns={columns}
                    data={terminals}
                    isLoading={isLoading}
                    variant="embedded"
                    filterColumn="name"
                    searchPlaceholder="Buscar caja por nombre..."
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
                    renderCustomView={(table) => (
                        <div className="flex flex-col gap-4 pt-2">
                            {table.getRowModel().rows.map(row => {
                                const terminal = row.original
                                const methodsByType = terminal.allowed_payment_methods.reduce((acc, method) => {
                                    const type = method.method_type
                                    if (!acc[type]) acc[type] = 0
                                    acc[type]++
                                    return acc
                                }, {} as Record<string, number>)

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
                                        <EntityCard.Footer className="justify-between items-center bg-muted/10 px-4 py-2 border-t">
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(methodsByType).map(([type, count]) => (
                                                    <div key={type} className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border bg-muted/30 text-[9px] uppercase font-bold text-foreground/70">
                                                        {type === 'CASH' && <Banknote className="h-3 w-3 text-success" />}
                                                        {type === 'CARD' && <CreditCard className="h-3 w-3 text-info" />}
                                                        {type === 'TRANSFER' && <Landmark className="h-3 w-3 text-primary" />}
                                                        {type} <span className="ml-0.5 opacity-60">({count})</span>
                                                    </div>
                                                ))}
                                                {terminal.allowed_payment_methods.length === 0 && (
                                                    <span className="text-[10px] text-muted-foreground italic">Sin métodos configurados</span>
                                                )}
                                            </div>
                                        </EntityCard.Footer>
                                    </EntityCard>
                                )
                            })}
                        </div>
                    )}
                />
            </div>

            <TerminalDrawer
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

export default TerminalManagement
