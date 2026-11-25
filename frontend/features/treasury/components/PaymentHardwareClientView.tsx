"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal } from "@/components/shared"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
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

    // Same query keys as the tab below (its `search.filters` is just `?search=`), so these share its cache.
    const deviceSearchText = searchParams.get("search")
    const deviceFilters = useMemo(() => {
        const out: Record<string, string> = {}
        if (deviceSearchText) out.search = deviceSearchText
        return out
    }, [deviceSearchText])
    const { providers, refetch: refetchProviders, deleteProvider } = useTerminalProviders()
    const { refetch: refetchDevices, deleteDevice } = useTerminalDevices(deviceFilters)

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
                <ProviderCollection actionsCtx={providerActionsCtx} createAction={providerCreateAction} />
            ) : (
                <DeviceCollection actionsCtx={deviceActionsCtx} createAction={deviceCreateAction} />
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

/** One tab at a time: each owns its command bar state in the URL (ADR-0158). */
function ProviderCollection({ actionsCtx, createAction }: { actionsCtx: ProviderActionsCtx; createAction: React.ReactNode }) {
    const query = useCollectionQuery(terminalProviderEntity, { sorting: "client" })
    const { search } = query
    const { providers, isLoading, error, refetch } = useTerminalProviders()
    const rows = useMemo(() => search.filterFn(providers), [search, providers])
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalprovider")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        terminalProviderEntity,
        { rows, isLoading, error: error && providers.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 20 }, sorting: query.sorting },
    )
    return (
        <Collection.Root collection={collection} query={query} view={view} onViewChange={onViewChange} actions={providerActions.forCollection(actionsCtx)}>
            <Collection.Toolbar action={createAction} />
            <Collection.View
                table={terminalProviderViews.table}
                card={terminalProviderViews.card}
                emptyTitle="Aún no hay proveedores de terminal de cobro"
                emptyDescription="Configura un proveedor (TUU, Transbank, etc.) para registrar sus terminales de cobro."
                emptyAction={createAction}
                onResetFilters={search.clearAll}
            />
        </Collection.Root>
    )
}

function DeviceCollection({ actionsCtx, createAction }: { actionsCtx: DeviceActionsCtx; createAction: React.ReactNode }) {
    const query = useCollectionQuery(terminalDeviceEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { devices, isLoading, error, refetch } = useTerminalDevices(search.filters)
    const { view, onViewChange } = useCollectionViewMode("treasury.terminaldevice")
    const collection = useEntityCollection(
        terminalDeviceEntity,
        { rows: devices, isLoading, error, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, sorting: query.sorting, groupBy },
    )
    return (
        <Collection.Root collection={collection} query={query} view={view} onViewChange={onViewChange} actions={deviceActions.forCollection(actionsCtx)}>
            <Collection.Toolbar action={createAction} />
            <Collection.View
                table={terminalDeviceViews.table}
                card={terminalDeviceViews.card}
                emptyTitle="Aún no hay terminales de cobro"
                emptyDescription="Registra terminales de cobro para conciliar sus transacciones."
                emptyAction={createAction}
                onResetFilters={search.clearAll}
            />
        </Collection.Root>
    )
}
