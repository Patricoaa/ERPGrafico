"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, EntityCard, SmartSearchBar, StatusBadge, useClientSearch, useSmartSearch } from '@/components/shared'
import { deviceSearchDef, providerSearchDef } from "@/features/treasury/searchDef"
import {
    Building2,
    Smartphone,
    CreditCard,
    User as UserIcon
} from "lucide-react"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { providerActions, type ProviderActionsCtx } from './providerActions'
import { deviceActions, type DeviceActionsCtx } from './deviceActions'

import { ProviderDrawer } from "./ProviderDrawer"
import { DeviceDrawer } from "./DeviceDrawer"

interface PaymentHardwareClientViewProps {
    externalDeviceOpen?: boolean
    externalProviderOpen?: boolean
    activeTab?: "providers" | "devices"
    createAction?: React.ReactNode
}

export function PaymentHardwareClientView({
    externalDeviceOpen,
    externalProviderOpen,
    activeTab: externalActiveTab,
    createAction
}: PaymentHardwareClientViewProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<"providers" | "devices">("devices")

    useEffect(() => {
        if (externalActiveTab) {
            requestAnimationFrame(() => setActiveTab(externalActiveTab))
        }
    }, [externalActiveTab])

    const { filters: deviceTextFilters, isFiltered: isDevicesTextFiltered } = useSmartSearch(deviceSearchDef)
    const isDevicesFiltered = isDevicesTextFiltered
    const deviceFilters = { ...deviceTextFilters }
    const { filterFn: filterProviders, isFiltered: isProvidersFiltered } = useClientSearch<PaymentTerminalProvider>(providerSearchDef)
    const { providers, isLoading: isLoadingProviders, refetch: refetchProviders, deleteProvider } = useTerminalProviders()
    const { devices, isLoading: isLoadingDevices, refetch: refetchDevices, deleteDevice } = useTerminalDevices(deviceFilters)

    const isCreateProvider = searchParams.get("modal") === "new-provider"
    const isCreateDevice = searchParams.get("modal") === "new-device"
    const { entity: selectedProvider, clearSelection: clearProvider } = useSelectedEntity<PaymentTerminalProvider>({ endpoint: '/treasury/terminal-providers', paramName: 'selected-provider' })
    const { entity: selectedDevice, clearSelection: clearDevice } = useSelectedEntity<PaymentTerminalDevice>({ endpoint: '/treasury/terminal-devices', paramName: 'selected-device' })

    const providerDialogOpen = isCreateProvider || !!selectedProvider
    const deviceDialogOpen = isCreateDevice || !!selectedDevice

    const clearAllParams = useCallback(() => {
        clearProvider()
        clearDevice()
        const params = new URLSearchParams(searchParams.toString())
        const changed = params.has("modal") || params.has("selected-provider") || params.has("selected-device")
        params.delete("modal")
        params.delete("selected-provider")
        params.delete("selected-device")
        if (changed) {
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [router, pathname, searchParams, clearProvider, clearDevice])

    const openProviderSelected = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected-provider", String(id))
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const openDeviceSelected = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected-device", String(id))
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    useEffect(() => {
        if (externalDeviceOpen) {
            requestAnimationFrame(() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("modal", "new-device")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            })
        }
    }, [externalDeviceOpen])

    useEffect(() => {
        if (externalProviderOpen) {
            requestAnimationFrame(() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("modal", "new-provider")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            })
        }
    }, [externalProviderOpen])

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

    const providerActionsCtx: ProviderActionsCtx = {
        onEdit: (provider) => openProviderSelected(provider.id),
        onDelete: (provider) => deleteProviderConfirm.requestConfirm(provider),
    }

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
        providerActions.column(providerActionsCtx)
    ]

    const deviceActionsCtx: DeviceActionsCtx = {
        onEdit: (device) => openDeviceSelected(device.id),
        onDelete: (device) => deleteDeviceConfirm.requestConfirm(device),
    }

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
        deviceActions.column(deviceActionsCtx)
    ]

    return (
        <div className="h-full flex flex-col">
            {activeTab === "providers" ? (
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="treasury.terminalprovider"
                        columns={providerColumns}
                        data={filterProviders(providers)}
                        isLoading={isLoadingProviders}
                        variant="embedded"
                        smartSearch={<SmartSearchBar searchDef={providerSearchDef} placeholder="Buscar proveedor..." className="w-full" />}
                        defaultPageSize={20}
                        isFiltered={isProvidersFiltered}
                        emptyState={{
                            context: "treasury",
                            title: "Aún no hay proveedores de terminal",
                            description: "Configura un proveedor (Transbank, etc.) para registrar sus dispositivos.",
                        }}
                        createAction={createAction || (
                            <Button onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set("modal", "new-provider")
                                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                            }} className="h-9">
                                Configurar proveedor
                            </Button>
                        )}
                        renderCard={(provider: PaymentTerminalProvider) => (
                            <EntityCard key={provider.id} onClick={() => openProviderSelected(provider.id)}>
                                <EntityCard.Header
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-primary" />
                                            {provider.name}
                                        </div>
                                    }
                                    trailing={<StatusBadge status={provider.is_active ? "active" : "inactive"} size="sm" />}
                                />
                                <EntityCard.Body actions={providerActions.render(provider, providerActionsCtx)}>
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
                        smartSearch={<SmartSearchBar searchDef={deviceSearchDef} placeholder="Buscar dispositivo..." className="w-full" />}
                        defaultPageSize={20}
                        isFiltered={isDevicesFiltered}
                        emptyState={{
                            context: "treasury",
                            title: "Aún no hay dispositivos",
                            description: "Registra terminales de pago (POS) para conciliar sus transacciones.",
                        }}
                        createAction={createAction || (
                            <Button onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set("modal", "new-device")
                                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                            }} className="h-9">
                                Registrar dispositivo
                            </Button>
                        )}
                        renderCard={(device: PaymentTerminalDevice) => (
                            <EntityCard key={device.id} onClick={() => openDeviceSelected(device.id)}>
                                <EntityCard.Header
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="h-4 w-4 text-info" />
                                            {device.name}
                                        </div>
                                    }
                                />
                                <EntityCard.Body actions={deviceActions.render(device, deviceActionsCtx)}>
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
                        )}
                        cardSkeleton={{ showFooter: true }}
                    />
                </div>
            )}

            {/* Dialogs */}
            <ProviderDrawer
                open={providerDialogOpen}
                onOpenChange={(v) => {
                    if (!v) clearAllParams()
                }}
                provider={isCreateProvider ? null : selectedProvider}
                onSuccess={() => { clearAllParams(); refetchProviders() }}
            />

            <DeviceDrawer
                open={deviceDialogOpen}
                onOpenChange={(v) => {
                    if (!v) clearAllParams()
                }}
                device={isCreateDevice ? null : selectedDevice}
                providers={providers}
                onSuccess={() => { clearAllParams(); refetchDevices() }}
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

export default PaymentHardwareClientView
