"use client"

import React, { useState, useEffect } from "react"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { Button } from "@/components/ui/button"
import { BaseModal, StatusBadge, SubmitButton, CancelButton, IconButton, LabeledInput, LabeledSelect, FormSection, MultiSelectTagInput, SmartSearchBar, useSmartSearch, useClientSearch } from "@/components/shared"
import { deviceSearchDef, providerSearchDef } from "@/features/treasury/searchDef"
import { toast } from "sonner"
import {
    Settings,
    Trash2,
    Building2,

    Smartphone,
    CreditCard,
    Link as LinkIcon,
    User as UserIcon
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { List, LayoutGrid } from "lucide-react"
import { EntityCard } from "@/components/shared/EntityCard"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

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
            await deleteProvider.mutateAsync(provider.id)
            refetchProviders()
        } catch (error) { }
    })

    const deleteDeviceConfirm = useConfirmAction<PaymentTerminalDevice>(async (device) => {
        try {
            await deleteDevice.mutateAsync(device.id)
            refetchDevices()
        } catch (error) { }
    })

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const [viewMode, setViewMode] = useState<string>(searchParams.get("view") ?? "card")

    const handleViewChange = (v: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', v)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        setViewMode(v)
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
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge status={row.original.is_active ? "active" : "inactive"} size="sm" />
                </div>
            ),
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
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge status={row.original.is_active ? "active" : "inactive"} size="sm" />
                </div>
            ),
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
        <div className="space-y-6">
            {createAction && (
                <div className="flex items-center justify-end">
                    {createAction}
                </div>
            )}
            {activeTab === "providers" ? (
                <DataTable
                    columns={providerColumns}
                    data={filterProviders(providers)}
                    isLoading={isLoadingProviders}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={providerSearchDef} placeholder="Buscar proveedor..." />}
                    defaultPageSize={20}
                    currentView={viewMode}
                    onViewChange={handleViewChange}
                    viewOptions={[
                        { label: "Lista", value: "list", icon: List },
                        { label: "Tarjeta", value: "card", icon: LayoutGrid }
                    ]}
                    createAction={createAction || (
                        <Button onClick={handleCreateProvider} className="h-9">
                            Configurar proveedor
                        </Button>
                    )}
                    renderLoadingView={viewMode === 'card' ? () => (
                        <div className="flex flex-col gap-4 pt-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <EntityCard.Skeleton key={i} />
                            ))}
                        </div>
                    ) : undefined}
                    renderCustomView={viewMode === 'card' ? (table) => (
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
                    ) : undefined}
                />
            ) : (
                <DataTable
                    columns={deviceColumns}
                    data={devices}
                    isLoading={isLoadingDevices}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={deviceSearchDef} placeholder="Buscar dispositivo..." className="w-80" />}
                    defaultPageSize={20}
                    currentView={viewMode}
                    onViewChange={handleViewChange}
                    viewOptions={[
                        { label: "Lista", value: "list", icon: List },
                        { label: "Tarjeta", value: "card", icon: LayoutGrid }
                    ]}
                    createAction={createAction || (
                        <Button onClick={handleCreateDevice} className="h-9">
                            Registrar dispositivo
                        </Button>
                    )}
                    renderLoadingView={viewMode === 'card' ? () => (
                        <div className="flex flex-col gap-4 pt-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <EntityCard.Skeleton key={i} />
                            ))}
                        </div>
                    ) : undefined}
                    renderCustomView={viewMode === 'card' ? (table) => (
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
                    ) : undefined}
                />
            )}

            {/* Dialogs */}
            <ProviderModal
                open={providerDialogOpen}
                onOpenChange={(v) => {
                    setProviderDialogOpen(v)
                    if (!v) onExternalProviderOpenChange?.(false)
                }}
                provider={editingProvider}
                onSuccess={refetchProviders}
            />

            <DeviceModal
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



/**
 * Modal for creating/editing Providers
 */
function ProviderModal({ open, onOpenChange, provider, onSuccess }: {
    open: boolean,
    onOpenChange: (v: boolean) => void,
    provider: PaymentTerminalProvider | null,
    onSuccess: () => void
}) {
    const { createProvider, updateProvider } = useTerminalProviders()
    const [name, setName] = useState("")
    const [type, setType] = useState<PaymentTerminalProvider['provider_type']>("MANUAL")
    const [supplierId, setSupplierId] = useState<number | null>(null)
    const [receivableAccount, setReceivableAccount] = useState<number | null>(null)
    const [expenseAccount, setExpenseAccount] = useState<number | null>(null)
    const [ivaAccount, setIvaAccount] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (provider) {
                    setName(provider.name)
                    setType(provider.provider_type)
                    setSupplierId(provider.supplier)
                    setReceivableAccount(provider.receivable_account)
                    setExpenseAccount(provider.commission_expense_account)
                    setIvaAccount(provider.commission_iva_account || null)
                } else {
                    setName("")
                    setType("MANUAL")
                    setSupplierId(null)
                    setReceivableAccount(null)
                    setExpenseAccount(null)
                    setIvaAccount(null)
                }
            })
        }
    }, [open, provider])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const data = {
                name: name.trim() || undefined, // Send undefined if empty to let backend handle it? No, backend needs a name.
                // We'll ensure name is set before sending.
                provider_type: type,
                supplier: supplierId,
                receivable_account: receivableAccount ? Number(receivableAccount) : undefined,
                commission_expense_account: expenseAccount ? Number(expenseAccount) : undefined,
                commission_iva_account: ivaAccount ? Number(ivaAccount) : undefined,
                is_active: true
            }

            // Fallback: If name is still empty, we use the contact name
            // But we don't have the contact object here unless we store it.
            // Actually, we can just ensure the form doesn't submit without a name, or auto-fill it.

            if (!data.name) {
                toast.error("Por favor, asigne un nombre o seleccione un contacto.")
                setLoading(false)
                return
            }

            if (provider) {
                await updateProvider.mutateAsync({ id: provider.id, data: data as any })
            } else {
                await createProvider.mutateAsync(data as any)
            }
            onSuccess()
            onOpenChange(false)
        } catch (error) {
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={provider ? "Editar Proveedor" : "Nuevo Proveedor de Pago"}
            description="Configure las cuentas contables para recaudación y comisiones."
            footer={
                <div className="flex justify-end gap-2">
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton loading={loading} onClick={handleSubmit}>
                        {provider ? "Guardar Cambios" : "Crear Proveedor"}
                    </SubmitButton>
                </div>
            }
        >
            <form className="space-y-4 py-2">
                <FormSection title="Información General" icon={Building2} />
                <div className="space-y-4">
                    <div className="space-y-2">
                        <AdvancedContactSelector
                            value={supplierId?.toString() || null}
                            onChange={(val) => setSupplierId(val ? parseInt(val) : null)}
                            onSelectContact={(contact) => {
                                if (!name) setName(contact.name)
                            }}
                            label="Contacto / Entidad (Proveedor)"
                        />
                    </div>

                    <div className="space-y-2">
                        <LabeledInput
                            label="Nombre / Alias"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Transbank Local Primary"

                        />
                    </div>
                </div>

                <FormSection title="Configuración Contable" icon={Settings} className="my-4" />

                <div className="space-y-4">
                    <div className="space-y-2">
                        <AccountSelector
                            value={receivableAccount?.toString() || null}
                            onChange={(v) => setReceivableAccount(v ? parseInt(v) : null)}
                            accountType="ASSET"
                            label="Cuenta Puente Recaudación"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <AccountSelector
                                value={expenseAccount?.toString() || null}
                                onChange={(v) => setExpenseAccount(v ? parseInt(v) : null)}
                                accountType="EXPENSE"
                                label="Cuenta Gasto Comisiones"
                            />
                        </div>
                        <div className="space-y-2">
                            <AccountSelector
                                value={ivaAccount?.toString() || null}
                                onChange={(v) => setIvaAccount(v ? parseInt(v) : null)}
                                accountType="ASSET"
                                label="Cuenta Puente IVA de Comisiones"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </BaseModal>
    )
}

/**
 * Modal for creating/editing Devices
 */
function DeviceModal({ open, onOpenChange, device, providers, onSuccess }: {
    open: boolean,
    onOpenChange: (v: boolean) => void,
    device: PaymentTerminalDevice | null,
    providers: PaymentTerminalProvider[],
    onSuccess: () => void
}) {
    const { createDevice, updateDevice } = useTerminalDevices()
    const [name, setName] = useState("")
    const [providerId, setProviderId] = useState<string>("")
    const [serialNumber, setSerialNumber] = useState("")
    const [model, setModel] = useState("")
    const [supportedMethods, setSupportedMethods] = useState<number[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (device) {
                    setName(device.name)
                    setProviderId(device.provider.toString())
                    setSerialNumber(device.serial_number)
                    setModel(device.model || "")
                    setSupportedMethods(device.supported_payment_methods || [])
                } else {
                    setName("")
                    setProviderId("")
                    setSerialNumber("")
                    setModel("")
                    setSupportedMethods([1, 2])
                }
            })
        }
    }, [open, device])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!providerId) {
            toast.error("Seleccione un proveedor")
            return
        }
        setLoading(true)
        try {
            const data = {
                name,
                provider: parseInt(providerId),
                serial_number: serialNumber,
                model: model || undefined,
                supported_payment_methods: supportedMethods,
                is_active: true
            }

            if (device) {
                await updateDevice.mutateAsync({ id: device.id, data })
            } else {
                await createDevice.mutateAsync(data)
            }
            onSuccess()
            onOpenChange(false)
        } catch (error) {
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={device ? "Editar Dispositivo" : "Registrar Nuevo Hardware"}
            description="Vincule una terminal física con un proveedor de servicios."
            footer={
                <div className="flex justify-end gap-2">
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton loading={loading} onClick={handleSubmit}>
                        {device ? "Guardar Cambios" : "Registrar"}
                    </SubmitButton>
                </div>
            }
        >
            <form className="space-y-4 py-2">
                <FormSection title="Información General" icon={Smartphone} />
                <LabeledInput
                    label="Nombre descriptivo"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Maquinita TUU 01"
                />

                <div className="grid grid-cols-2 gap-4">
                    <LabeledSelect
                        label="Proveedor"
                        required
                        value={providerId}
                        onChange={setProviderId}
                        placeholder="Seleccione..."
                        options={providers.map(p => ({ value: p.id.toString(), label: p.name }))}
                    />
                    <div>
                        <LabeledInput
                            label="Número de Serie / TID"
                            required
                            value={serialNumber}
                            onChange={e => setSerialNumber(e.target.value)}
                            placeholder="Número serie físico"
                        />
                    </div>
                </div>

                <LabeledInput
                    label="Modelo (Opcional)"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="Ej: Pax A920"
                />

                <div className="space-y-3 pt-2">
                    <MultiSelectTagInput
                        label="Capacidades del Hardware"
                        options={[
                            { label: "DÉBITO", value: "2" },
                            { label: "CRÉDITO", value: "1" }
                        ]}
                        value={supportedMethods.map(m => m.toString())}
                        onChange={(vals) => setSupportedMethods(vals.map(v => parseInt(v)))}
                        placeholder="Seleccione capacidades..."
                        hint="Marque solo los métodos que su terminal física permite procesar."
                    />
                </div>
            </form>
        </BaseModal>
    )
}



export default PaymentHardwareManagement
