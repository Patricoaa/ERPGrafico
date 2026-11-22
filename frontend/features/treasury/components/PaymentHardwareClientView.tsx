"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import type { UnifiedSearchConfig } from "@/types/unified-search"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { terminalProviderEntity, terminalProviderViews } from "../entity-view/terminalProvider.entity"
import { terminalDeviceEntity, terminalDeviceViews } from "../entity-view/terminalDevice.entity"
import { providerActions, type ProviderActionsCtx } from "./providerActions"
import { deviceActions, type DeviceActionsCtx } from "./deviceActions"
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
    const { providers, isLoading: isLoadingProviders, error: providersError, refetch: refetchProviders, deleteProvider } = useTerminalProviders()
    const { devices, isLoading: isLoadingDevices, error: devicesError, refetch: refetchDevices, deleteDevice } = useTerminalDevices(deviceFilters)
    const { filterFn: providerFilterFn } = providerSearch
    const providerRows = useMemo(() => providerFilterFn(providers), [providerFilterFn, providers])
    const providerView = useCollectionViewMode("treasury.terminalprovider")
    const deviceView = useCollectionViewMode("treasury.terminaldevice")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const providerCollection = useEntityCollection(
        terminalProviderEntity,
        { rows: providerRows, isLoading: isLoadingProviders, error: providersError && providers.length === 0, refetch: refetchProviders, isFiltered: providerSearch.isFiltered },
        { pagination: { mode: "client", pageSize: 20 }, defaultSort: terminalProviderViews.table.defaultSort },
    )
    const deviceCollection = useEntityCollection(
        terminalDeviceEntity,
        { rows: devices, isLoading: isLoadingDevices, error: devicesError, refetch: refetchDevices, isFiltered: deviceSearch.isFiltered },
        { pagination: { mode: "client", pageSize: 20 }, defaultSort: terminalDeviceViews.table.defaultSort },
    )

    const providerPanel = useCreatePanelRoute({ selectedParam: 'selected-provider', createValue: 'new-provider', resolved: false })
    const devicePanel = useCreatePanelRoute({ selectedParam: 'selected-device', createValue: 'new-device', resolved: false })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada proveedor/terminal abre su propia pestaña; `?selected-*` solo es enlace profundo.
    useDeepLinkEntity("treasury.terminalprovider", { selectedParam: "selected-provider" })
    useDeepLinkEntity("treasury.terminaldevice", { selectedParam: "selected-device" })


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
        onEdit: (provider) => openEntity("treasury.terminalprovider", provider.id, provider),
        onDelete: (provider) => deleteProviderConfirm.requestConfirm(provider),
    }

    const deviceActionsCtx: DeviceActionsCtx = {
        onEdit: (device) => openEntity("treasury.terminaldevice", device.id, device),
        onDelete: (device) => deleteDeviceConfirm.requestConfirm(device),
    }

    const openCreate = (modal: "new-provider" | "new-device") => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("modal", modal)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    const providerCreateAction = createAction || <Button onClick={() => openCreate("new-provider")} className="h-control-md">Configurar proveedor</Button>
    const deviceCreateAction = createAction || <Button onClick={() => openCreate("new-device")} className="h-control-md">Registrar terminal de cobro</Button>

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {activeTab === "providers" ? (
                <Collection.Root
                    collection={providerCollection}
                    view={providerView.view}
                    onViewChange={providerView.onViewChange}
                    actions={providerActions.forCollection(providerActionsCtx)}
                >
                    <Collection.Toolbar action={providerCreateAction}>
                        <UnifiedSearchBar config={providerConfig} {...bindUnifiedSearch(providerSearch)} placeholder="Buscar proveedor..." />
                    </Collection.Toolbar>
                    <Collection.View
                        table={terminalProviderViews.table}
                        card={terminalProviderViews.card}
                        emptyTitle="Aún no hay proveedores de terminal de cobro"
                        emptyDescription="Configura un proveedor (TUU, Transbank, etc.) para registrar sus terminales de cobro."
                        emptyAction={providerCreateAction}
                        onResetFilters={providerSearch.clearAll}
                    />
                </Collection.Root>
            ) : (
                <Collection.Root
                    collection={deviceCollection}
                    view={deviceView.view}
                    onViewChange={deviceView.onViewChange}
                    actions={deviceActions.forCollection(deviceActionsCtx)}
                >
                    <Collection.Toolbar action={deviceCreateAction}>
                        <UnifiedSearchBar config={deviceConfig} {...bindUnifiedSearch(deviceSearch)} placeholder="Buscar terminal de cobro..." />
                    </Collection.Toolbar>
                    <Collection.View
                        table={terminalDeviceViews.table}
                        card={terminalDeviceViews.card}
                        emptyTitle="Aún no hay terminales de cobro"
                        emptyDescription="Registra terminales de cobro para conciliar sus transacciones."
                        emptyAction={deviceCreateAction}
                        onResetFilters={deviceSearch.clearAll}
                    />
                </Collection.Root>
            )}

            {/* Dialogs */}
            <EntityPanelTab label="treasury.terminalprovider" {...providerPanel.tab}>
                {(open) => (
                    <ProviderDrawer
                        open={open}
                        onOpenChange={(v) => { if (!v) providerPanel.close() }}
                        provider={null}
                        onSuccess={() => { providerPanel.close(); refetchProviders() }}
                    />
                )}
            </EntityPanelTab>

            <EntityPanelTab label="treasury.terminaldevice" {...devicePanel.tab}>
                {(open) => (
                    <DeviceDrawer
                        open={open}
                        onOpenChange={(v) => { if (!v) devicePanel.close() }}
                        device={null}
                        providers={providers}
                        onSuccess={() => { devicePanel.close(); refetchDevices() }}
                    />
                )}
            </EntityPanelTab>

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
                title="Eliminar terminal de cobro"
                description="¿Está seguro de eliminar este terminal de cobro? Se perderá el vínculo con las cajas POS."
                variant="destructive"
            />
        </div>
    )
}

export default PaymentHardwareClientView
