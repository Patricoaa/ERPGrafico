"use client"

import React, { useState, useEffect } from "react"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { Button } from "@/components/ui/button"
import { StatusBadge, IconButton, SmartSearchBar, useSmartSearch, useClientSearch } from "@/components/shared"
import { deviceSearchDef, providerSearchDef } from "@/features/treasury/searchDef"
import {
    Settings,
    Trash2,
    Building2,

    Smartphone,
    CreditCard,
    Link as LinkIcon,
    User as UserIcon
} from "lucide-react"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { createActionsColumn, DataCell } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { EntityCard } from "@/components/shared/EntityCard"
import { ProviderDrawer } from "./ProviderDrawer"
import { DeviceDrawer } from "./DeviceDrawer"

interface PaymentHardwareManagementProps {
    externalDeviceOpen?: boolean
    onExternalDeviceOpenChange?: (open: boolean) => void
    externalProviderOpen?: boolean
    onExternalProviderOpenChange?: (open: boolean) => void
    activeTab?: "providers" | "devices"
    createAction?: React.ReactNode
}

export function PaymentHardwareManagement({
    externalDeviceOpen,
    onExternalDeviceOpenChange,
    externalProviderOpen,
    onExternalProviderOpenChange,
    activeTab: externalActiveTab,
    createAction
}: PaymentHardwareManagementProps) {
    const [activeTab, setActiveTab] = useState<"providers" | "devices">("devices")

    useEffect(() => {
        if (externalActiveTab) {
            requestAnimationFrame(() => setActiveTab(externalActiveTab))
        }
    }, [externalActiveTab])

    const { filters: deviceFilters } = useSmartSearch(deviceSearchDef)
    const { filterFn: filterProviders } = useClientSearch<PaymentTerminalProvider>(providerSearchDef)
    const { providers, isLoading: isLoadingProviders, refetch: refetchProviders, deleteProvider } = useTerminalProviders()
    const { devices, isLoading: isLoadingDevices, refetch: refetchDevices, deleteDevice } = useTerminalDevices(deviceFilters)

    const [providerDialogOpen, setProviderDialogOpen] = useState(false)
    const [editingProvider, setEditingProvider] = useState<PaymentTerminalProvider | null>(null)

    const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)
    const [editingDevice, setEditingDevice] = useState<PaymentTerminalDevice | null>(null)

    const handleCreateProvider = () => {
        setEditingProvider(null)
        setProviderDialogOpen(true)
    }

    const handleCreateDevice = () => {
        setEditingDevice(null)
        setDeviceDialogOpen(true)
        onExternalDeviceOpenChange?.(false)
    }

    useEffect(() => {
        if (externalDeviceOpen) {
            requestAnimationFrame(() => handleCreateDevice())
        }
    }, [externalDeviceOpen])

    useEffect(() => {
        if (externalProviderOpen) {
            requestAnimationFrame(() => handleCreateProvider())
        }
    }, [externalProviderOpen])

    const handleEditProvider = (provider: PaymentTerminalProvider) => {
        setEditingProvider(provider)
        setProviderDialogOpen(true)
    }



    const handleEditDevice = (device: PaymentTerminalDevice) => {
        setEditingDevice(device)
        setDeviceDialogOpen(true)
    }

    const deleteProviderConfirm = useConfirmAction<PaymentTerminalProvider>(async (provider) => {
        try {
            await deleteProvider(provider.id)
        } catch { }
    })

    const deleteDeviceConfirm = useConfirmAction<PaymentTerminalDevice>(async (device) => {
        try {
            await deleteDevice(device.id)
        } catch { }
    })

    const providerColumns: ColumnDef<PaymentTerminalProvider>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-semibold text-sm">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("supplier_name") || "-"}</div>,
        },
        {
            accessorKey: "receivable_account_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta Recaudación" />,
            cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("receivable_account_name") || "-"}</div>,
        },
        {
            accessorKey: "is_active",
            id: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={row.original.is_active ? "active" : "inactive"} />,
            filterFn: (row, id, value) => value.includes(row.getValue(id) ? "ACTIVE" : "INACTIVE")
        },
        createActionsColumn<PaymentTerminalProvider>({
            renderActions: (provider) => (
                <>
                    <DataCell.Action
                        icon={Settings}
                        title="Editar"
                        onClick={() => handleEditProvider(provider)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteProviderConfirm.requestConfirm(provider)}
                    />
                </>
            )
        })
    ]

    const deviceColumns: ColumnDef<PaymentTerminalDevice>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-semibold text-sm">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "provider_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
            cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("provider_name")}</div>,
        },
        {
            accessorKey: "serial_number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="N° Serie" />,
            cell: ({ row }) => <div className="font-mono text-muted-foreground">{row.getValue("serial_number")}</div>,
        },
        {
            accessorKey: "is_active",
            id: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={row.original.is_active ? "active" : "inactive"} />,
            filterFn: (row, id, value) => value.includes(row.getValue(id) ? "ACTIVE" : "INACTIVE")
        },
        createActionsColumn<PaymentTerminalDevice>({
            renderActions: (device) => (
                <>
                    <DataCell.Action
                        icon={Settings}
                        title="Editar"
                        onClick={() => handleEditDevice(device)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteDeviceConfirm.requestConfirm(device)}
                    />
                </>
            )
        })
    ]


    return (
        <div className="h-full flex flex-col">
            {createAction && (
                <div className="flex items-center justify-end">
                    {createAction}
                </div>
            )}
            {activeTab === "providers" ? (
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="treasury.terminalprovider"
                        columns={providerColumns}
                        data={filterProviders(providers)}
                        isLoading={isLoadingProviders}
                        variant="embedded"
                        leftAction={<SmartSearchBar searchDef={providerSearchDef} placeholder="Buscar proveedor..." className="w-full" />}
                        defaultPageSize={20}
                        createAction={createAction || (
                            <Button onClick={handleCreateProvider} className="h-9">
                                Configurar proveedor
                            </Button>
                        )}
                        renderCustomView={(table) => (
                            <div className="flex flex-col gap-4 pt-2">
                                {table.getRowModel().rows.map(row => {
                                    const provider = row.original
                                    return (
                                        <EntityCard key={provider.id}>
                                            <EntityCard.Header
                                                title={
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-primary" />
                                                        {provider.name}
                                                    </div>
                                                }
                                                trailing={
                                                    <div className="flex flex-col items-end gap-2">
                                                        <StatusBadge status={provider.is_active ? "active" : "inactive"} size="sm" />
                                                        <div className="flex items-center gap-1">
                                                            <IconButton onClick={() => handleEditProvider(provider)} className="h-7 w-7"><Settings className="h-3 w-3" /></IconButton>
                                                            <IconButton onClick={() => deleteProviderConfirm.requestConfirm(provider)} className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></IconButton>
                                                        </div>
                                                    </div>
                                                }
                                            />
                                            <EntityCard.Body>
                                                <EntityCard.Field
                                                    label="Recaudación"
                                                    value={provider.receivable_account_name || "No configurada"}
                                                    icon={Building2}
                                                />
                                                {provider.supplier_name && (
                                                    <EntityCard.Field
                                                        label="Contacto"
                                                        value={provider.supplier_name}
                                                        icon={UserIcon}
                                                    />
                                                )}
                                            </EntityCard.Body>
                                        </EntityCard>
                                    )
                                })}
                            </div>
                        )}
                    />
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="treasury.terminaldevice"
                        columns={deviceColumns}
                        data={devices}
                        isLoading={isLoadingDevices}
                        variant="embedded"
                        leftAction={<SmartSearchBar searchDef={deviceSearchDef} placeholder="Buscar dispositivo..." className="w-full" />}
                        defaultPageSize={20}
                        createAction={createAction || (
                            <Button onClick={handleCreateDevice} className="h-9">
                                Registrar dispositivo
                            </Button>
                        )}
                        renderCustomView={(table) => (
                            <div className="flex flex-col gap-4 pt-2">
                                {table.getRowModel().rows.map(row => {
                                    const device = row.original
                                    return (
                                        <EntityCard key={device.id}>
                                            <EntityCard.Header
                                                title={
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="h-4 w-4 text-info" />
                                                        {device.name}
                                                    </div>
                                                }
                                                trailing={
                                                    <div className="flex flex-col items-end gap-2">
                                                        <StatusBadge status={device.is_active ? "active" : "inactive"} size="sm" />
                                                        <div className="flex items-center gap-1">
                                                            <IconButton onClick={() => handleEditDevice(device)} className="h-7 w-7"><Settings className="h-3 w-3" /></IconButton>
                                                            <IconButton onClick={() => deleteDeviceConfirm.requestConfirm(device)} className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></IconButton>
                                                        </div>
                                                    </div>
                                                }
                                            />
                                            <EntityCard.Body>
                                                <EntityCard.Field
                                                    label="Proveedor"
                                                    value={device.provider_name || "Sin proveedor"}
                                                    icon={Building2}
                                                />
                                                <EntityCard.Field
                                                    label="N° Serie"
                                                    value={<span className="font-mono">{device.serial_number}</span>}
                                                    icon={CreditCard}
                                                />
                                            </EntityCard.Body>
                                            <EntityCard.Footer className="justify-between items-center bg-muted/10 px-4 py-2 border-t">
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase mr-2">Soporta:</span>
                                                    {device.supported_payment_methods?.includes(2) && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 rounded-sm">DÉBITO</span>
                                                    )}
                                                    {device.supported_payment_methods?.includes(1) && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 rounded-sm">CRÉDITO</span>
                                                    )}
                                                    {(!device.supported_payment_methods || device.supported_payment_methods.length === 0) && (
                                                        <span className="text-[10px] italic opacity-50">SIN CONFIG</span>
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
            )}

            {/* Dialogs */}
            <ProviderDrawer
                open={providerDialogOpen}
                onOpenChange={(v) => {
                    setProviderDialogOpen(v)
                    if (!v) onExternalProviderOpenChange?.(false)
                }}
                provider={editingProvider}
                onSuccess={refetchProviders}
            />

            <DeviceDrawer
                open={deviceDialogOpen}
                onOpenChange={(v) => {
                    setDeviceDialogOpen(v)
                    if (!v) onExternalDeviceOpenChange?.(false)
                }}
                device={editingDevice}
                providers={providers}
                onSuccess={refetchDevices}
            />

            {/* Confirmation Modals */}
            <ActionConfirmModal
                open={deleteProviderConfirm.isOpen}
                onOpenChange={(v) => !v && deleteProviderConfirm.cancel()}
                onConfirm={deleteProviderConfirm.confirm}
                title="Eliminar Proveedor"
                description="¿Está seguro de eliminar este proveedor? Se perderá la configuración contable."
                variant="destructive"
            />

            <ActionConfirmModal
                open={deleteDeviceConfirm.isOpen}
                onOpenChange={(v) => !v && deleteDeviceConfirm.cancel()}
                onConfirm={deleteDeviceConfirm.confirm}
                title="Eliminar Dispositivo"
                description="¿Está seguro de eliminar este hardware? Se perderá el vínculo con las terminales POS."
                variant="destructive"
            />
        </div>
    )
}





export default PaymentHardwareManagement
