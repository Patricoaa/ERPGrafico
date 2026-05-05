"use client"

import React, { useState, useEffect } from "react"
import { useTerminalProviders, useTerminalDevices, type PaymentTerminalProvider, type PaymentTerminalDevice } from "../hooks/useTerminalProviders"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BaseModal, EmptyState, StatusBadge, SubmitButton, CancelButton, IconButton, LabeledInput, LabeledSelect, FormSection, MultiSelectTagInput } from "@/components/shared"
import { toast } from "sonner"
import {
    Settings,
    Trash2,
    Loader2,
    Building2,

    Smartphone,
    CreditCard,
    Link as LinkIcon,
    User as UserIcon
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { cn } from "@/lib/utils"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useConfirmAction } from "@/hooks/useConfirmAction"

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

    const { providers, isLoading: loadingProviders, refetch: refetchProviders, deleteProvider } = useTerminalProviders()
    const { devices, isLoading: loadingDevices, refetch: refetchDevices, deleteDevice } = useTerminalDevices()

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

    const isLoading = loadingProviders || loadingDevices

    return (
        <div className="space-y-6">
            {createAction && (
                <div className="flex items-center justify-end">
                    {createAction}
                </div>
            )}
            {activeTab === "providers" ? (
                <div className="m-0 outline-none">
                    {loadingProviders ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-20" />
                        </div>
                    ) : providers.length === 0 ? (
                        <EmptyState
                            context="finance"
                            title="No hay proveedores configurados"
                            description="Configure los proveedores de pago (TUU, Transbank, etc.) para procesar transacciones."
                            action={<Button onClick={handleCreateProvider} variant="outline" size="sm">Configurar primer proveedor</Button>}
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {providers.map(provider => (
                                <ProviderCard
                                    key={provider.id}
                                    provider={provider}
                                    onEdit={() => handleEditProvider(provider)}
                                    onDelete={() => deleteProviderConfirm.requestConfirm(provider)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="m-0 outline-none">
                    {loadingDevices ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-20" />
                        </div>
                    ) : devices.length === 0 ? (
                        <EmptyState
                            context="production"
                            title="No hay dispositivos registrados"
                            description="Registre las terminales físicas (maquinitas) y vincúlelas a un proveedor de pago."
                            action={<Button onClick={handleCreateDevice} variant="outline" size="sm">Registrar dispositivo</Button>}
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {devices.map(device => (
                                <DeviceCard
                                    key={device.id}
                                    device={device}
                                    onEdit={() => handleEditDevice(device)}
                                    onDelete={() => deleteDeviceConfirm.requestConfirm(device)}
                                />
                            ))}
                        </div>
                    )}
                </div>
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

function ProviderCard({ provider, onEdit, onDelete }: { provider: PaymentTerminalProvider, onEdit: () => void, onDelete: () => void }) {
    return (
        <Card className="bg-background hover:shadow-md transition-all border-2">
            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">{provider.name}</CardTitle>
                        </div>
                        <div className="flex flex-col gap-1.5 p-3 rounded-sm bg-muted/30 border border-muted/50">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight"> {/* intentional: badge density */} Recaudación:</span>
                                <span className="text-[11px] font-medium ml-auto"> {/* intentional: badge density */} {provider.receivable_account_name}</span>
                            </div>
                            {provider.supplier_name && (
                                <div className="flex items-center gap-2 pt-1.5 border-t border-muted/30">
                                    <UserIcon className="w-3.5 h-3.5 text-primary/60" />
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight"> {/* intentional: badge density */} Contacto:</span>
                                    <span className="text-[11px] font-medium ml-auto text-primary/80"> {/* intentional: badge density */} {provider.supplier_name}</span>
                                </div>
                            )}
                        </div>
                        <StatusBadge status={provider.is_active ? "active" : "inactive"} size="sm" />
                    </div>
                    <div className="flex gap-1">
                        <IconButton onClick={onEdit} className="h-7 w-7"><Settings className="h-3.5 w-3.5" /></IconButton>
                        <IconButton onClick={onDelete} className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </div>
                </div>
            </CardHeader>
        </Card>
    )
}

function DeviceCard({ device, onEdit, onDelete }: { device: PaymentTerminalDevice, onEdit: () => void, onDelete: () => void }) {
    return (
        <Card className="bg-background hover:shadow-md transition-all border-2">
            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-info" />
                            <CardTitle className="text-sm">{device.name}</CardTitle>
                        </div>
                        <StatusBadge status={device.is_active ? "active" : "inactive"} size="sm" />
                    </div>
                    <div className="flex gap-1">
                        <IconButton onClick={onEdit} className="h-7 w-7"><Settings className="h-3.5 w-3.5" /></IconButton>
                        <IconButton onClick={onDelete} className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-1 gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider"> {/* intentional: badge density */}
                    <div className="flex justify-between">
                        <span>Proveedor:</span>
                        <span className="text-foreground">{device.provider_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>N° Serie:</span>
                        <span className="text-foreground font-mono">{device.serial_number}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span>Soporta:</span>
                        <div className="flex gap-1">
                            {device.supported_payment_methods?.includes(2) && (
                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm">DÉBITO</span>
                            )}
                            {device.supported_payment_methods?.includes(1) && (
                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-sm">CRÉDITO</span>
                            )}
                            {(!device.supported_payment_methods || device.supported_payment_methods.length === 0) && (
                                <span className="text-[10px] italic opacity-50"> {/* intentional: badge density */} SIN CONFIG</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
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
