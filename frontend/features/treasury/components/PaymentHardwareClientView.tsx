"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import {
    Building2,
} from "lucide-react"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { DataTableView } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { providerActions, type ProviderActionsCtx } from './providerActions'
import { deviceActions, type DeviceActionsCtx } from './deviceActions'

import { ProviderDrawer } from "./ProviderDrawer"
import { DeviceDrawer } from "./DeviceDrawer"
import { terminalProviderFields } from "@/features/treasury/terminalProviderFields"
import { terminalDeviceFields } from "@/features/treasury/terminalDeviceFields"

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

    const deviceConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Nombre', serverParam: 'search' },
        ],
    }), [])
    const deviceSearch = useUnifiedSearch(deviceConfig)
    const deviceFilters = { ...deviceSearch.filters }

    const providerConfig: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'name', label: 'Nombre', serverParam: 'name', clientKey: ['name'] },
        ],
    }), [])
    const providerSearch = useUnifiedSearch(providerConfig)
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
        ...terminalProviderFields.toColumns(),
        providerActions.auto(providerActionsCtx)
    ]

    const deviceActionsCtx: DeviceActionsCtx = {
        onEdit: (device) => openDeviceSelected(device.id),
        onDelete: (device) => deleteDeviceConfirm.requestConfirm(device),
    }

    const deviceColumns: ColumnDef<PaymentTerminalDevice>[] = [
        ...terminalDeviceFields.toColumns(),
        deviceActions.auto(deviceActionsCtx)
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {activeTab === "providers" ? (
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="treasury.terminalprovider"
                        columns={providerColumns}
                        data={providerSearch.filterFn(providers)}
                        isLoading={isLoadingProviders}
                        variant="embedded"
                        unifiedSearch={<UnifiedSearchBar
                            config={providerConfig}
                            chips={providerSearch.chips}
                            isFiltered={providerSearch.isFiltered}
                            inputValue={providerSearch.inputValue}
                            onInputChange={providerSearch.setInputValue}
                            onApply={providerSearch.applyFilter}
                            onRemove={providerSearch.removeFilter}
                            onClearAll={providerSearch.clearAll}
                            groupBy={providerSearch.groupBy}
                            onGroupBySelect={providerSearch.setGroupBy}
                            paramValues={providerSearch.paramValues}
                            placeholder="Buscar proveedor..."
                        />}
                        defaultPageSize={20}
                        isFiltered={providerSearch.isFiltered}
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
                            <AutoEntityCard
                                key={provider.id}
                                data={provider}
                                fields={terminalProviderFields}
                                entityLabel="treasury.paymentterminalprovider"
                                icon={Building2}

                                actions={providerActions.render(provider, providerActionsCtx)}
                                onClick={() => openProviderSelected(provider.id)}
                                defaultAction={providerActions.defaultAction(providerActionsCtx)?.(provider) ?? null}
                            />
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
                        unifiedSearch={<UnifiedSearchBar
                            config={deviceConfig}
                            chips={deviceSearch.chips}
                            isFiltered={deviceSearch.isFiltered}
                            inputValue={deviceSearch.inputValue}
                            onInputChange={deviceSearch.setInputValue}
                            onApply={deviceSearch.applyFilter}
                            onRemove={deviceSearch.removeFilter}
                            onClearAll={deviceSearch.clearAll}
                            groupBy={deviceSearch.groupBy}
                            onGroupBySelect={deviceSearch.setGroupBy}
                            paramValues={deviceSearch.paramValues}
                            placeholder="Buscar dispositivo..."
                        />}
                        defaultPageSize={20}
                        isFiltered={deviceSearch.isFiltered}
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
                            <AutoEntityCard
                                key={device.id}
                                data={device}
                                fields={terminalDeviceFields}
                                entityLabel="treasury.paymentterminaldevice"
                                actions={deviceActions.render(device, deviceActionsCtx)}
                                onClick={() => openDeviceSelected(device.id)}
                                defaultAction={deviceActions.defaultAction(deviceActionsCtx)?.(device) ?? null}
                            />
                        )}
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
