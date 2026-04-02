"use client"

import { useState, useEffect } from "react"
import { useTerminals, type Terminal, type PaymentMethod } from "@/features/treasury"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BaseModal } from "@/components/shared/BaseModal"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/EmptyState"
import { Plus, Power, PowerOff, Settings, MapPin, Trash2, Loader2, CreditCard, Banknote, Landmark, History, MonitorSmartphone } from "lucide-react"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"



interface TerminalManagementProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function TerminalManagement({ externalOpen, onExternalOpenChange }: TerminalManagementProps) {
    const { terminals, toggleActive, deleteTerminal, refetch } = useTerminals()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null)

    useEffect(() => {
        if (externalOpen) {
            handleCreate()
        }
    }, [externalOpen])

    const handleEdit = (terminal: Terminal) => {
        setEditingTerminal(terminal)
        setDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingTerminal(null)
        setDialogOpen(true)
        onExternalOpenChange?.(false)
    }

    const handleToggleActive = async (terminal: Terminal) => {
        try {
            await toggleActive(terminal)
        } catch (error) {
            // Error already handled by hook
        }
    }

    const deleteConfirm = useConfirmAction<Terminal>(async (terminal) => {
        try {
            await deleteTerminal(terminal)
        } catch (error) {
            // Error already handled by hook
        }
    })

    const handleDelete = (terminal: Terminal) => {
        deleteConfirm.requestConfirm(terminal)
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-between items-center bg-white/50 p-5 rounded-xl border border-primary/10 backdrop-blur-md shadow-sm hidden">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary">Terminales POS</h2>
                    <p className="text-sm text-muted-foreground">Administre los puntos de venta y sus métodos de pago autorizados.</p>
                </div>
                <Button onClick={handleCreate} size="lg" className="rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                    <Plus className="mr-2 h-5 w-5" /> Nuevo Terminal
                </Button>
            </div>

            {terminals.length === 0 ? (
                <EmptyState
                    icon={MonitorSmartphone}
                    title="No hay terminales configurados"
                    description="Administre los puntos de venta y sus métodos de pago autorizados desde aquí."
                    action={
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" /> Crear primer terminal
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {terminals.map((terminal) => (
                        <TerminalCard
                            key={terminal.id}
                            terminal={terminal}
                            onEdit={() => handleEdit(terminal)}
                            onToggleActive={() => handleToggleActive(terminal)}
                            onDelete={() => handleDelete(terminal)}
                        />
                    ))}
                </div>
            )}

            <TerminalDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                terminal={editingTerminal}
                onSuccess={refetch}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Terminal"
                description={`¿Está seguro de eliminar el terminal "${deleteConfirm.payload?.name || ''}"? Esta acción no se puede deshacer.`}
                variant="destructive"
            />
        </div>
    )
}

function TerminalCard({ terminal, onEdit, onToggleActive, onDelete }: {
    terminal: Terminal,
    onEdit: () => void,
    onToggleActive: () => void,
    onDelete: () => void
}) {
    // Group methods for display
    const methodsByType = terminal.allowed_payment_methods.reduce((acc, method) => {
        const type = method.method_type
        if (!acc[type]) acc[type] = 0
        acc[type]++
        return acc
    }, {} as Record<string, number>)

    return (
        <Card className={`transition-all hover:shadow-md ${!terminal.is_active ? "opacity-70 bg-muted/20" : "bg-white"}`}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                            {terminal.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] bg-muted">
                                {terminal.code}
                            </Badge>
                            {terminal.is_active ? (
                                <Badge variant="default" className="text-[10px] bg-emerald-500 hover:bg-emerald-600">
                                    Activo
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                    Inactivo
                                </Badge>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8 -mr-2">
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
                {terminal.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {terminal.location}
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métodos Habilitados</p>
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(methodsByType).map(([type, count]) => (
                            <Badge key={type} variant="secondary" className="text-[10px] px-1.5 font-normal">
                                {type === 'CASH' && <Banknote className="h-3 w-3 mr-1 text-success" />}
                                {type === 'CARD' && <CreditCard className="h-3 w-3 mr-1 text-info" />}
                                {type === 'TRANSFER' && <Landmark className="h-3 w-3 mr-1 text-indigo-500" />}
                                {type} <span className="ml-1 text-muted-foreground">({count})</span>
                            </Badge>
                        ))}
                        {terminal.allowed_payment_methods.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">Ninguno configurado</span>
                        )}
                    </div>
                </div>

                <div className="pt-2 border-t flex justify-end gap-2">
                    <Button
                        variant={terminal.is_active ? "ghost" : "outline"}
                        size="sm"
                        className={`h-7 text-xs ${terminal.is_active ? "text-muted-foreground hover:text-destructive" : ""}`}
                        onClick={onToggleActive}
                    >
                        {terminal.is_active ? <PowerOff className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                        {terminal.is_active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/5"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function TerminalDialog({ open, onOpenChange, terminal, onSuccess }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    terminal: Terminal | null
    onSuccess: () => void
}) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [location, setLocation] = useState("")
    const [serialNumber, setSerialNumber] = useState("")
    const [ipAddress, setIpAddress] = useState("")

    // Payment Methods State
    const [allMethods, setAllMethods] = useState<PaymentMethod[]>([])
    const [selectedMethodIds, setSelectedMethodIds] = useState<number[]>([])

    useEffect(() => {
        if (open) {
            fetchMethods()
            if (terminal) {
                setName(terminal.name)
                setCode(terminal.code)
                setLocation(terminal.location || "")
                setSerialNumber(terminal.serial_number || "")
                setIpAddress(terminal.ip_address || "")
                setSelectedMethodIds(terminal.allowed_payment_methods.map(m => m.id))
            } else {
                setName("")
                setCode("")
                setLocation("")
                setSerialNumber("")
                setIpAddress("")
                setSelectedMethodIds([])
            }
        }
    }, [open, terminal])

    const fetchMethods = async () => {
        try {
            const res = await api.get('/treasury/payment-methods/')
            // Only active methods AND only those suitable for a Terminal (Collection)
            const methods = (res.data.results || res.data).filter((m: PaymentMethod) => m.is_active)

            // Refined filter: terminals should only handle collection methods
            const collectionMethods = methods.filter((m: PaymentMethod) =>
                ['CARD_TERMINAL', 'CASH', 'TRANSFER', 'CHECK'].includes(m.method_type) && m.allow_for_sales === true
            )

            setAllMethods(collectionMethods)
        } catch (error) {
            console.error("Error fetching methods", error)
        }
    }

    const toggleMethod = (methodId: number) => {
        setSelectedMethodIds(prev => {
            const isSelected = prev.includes(methodId)
            if (isSelected) {
                return prev.filter(id => id !== methodId)
            } else {
                // Validation: Max 1 CASH method
                const methodToAdd = allMethods.find(m => m.id === methodId)
                if (methodToAdd?.method_type === 'CASH') {
                    const existingCash = allMethods.find(m =>
                        prev.includes(m.id) && m.method_type === 'CASH'
                    )
                    if (existingCash) {
                        toast.warning("Solo se puede seleccionar 1 método de EFECTIVO (Caja) por terminal.")
                        return prev
                    }
                }

                // Validation: Max 1 CARD_TERMINAL method
                if (methodToAdd?.method_type === 'CARD_TERMINAL') {
                    const existingTerminal = allMethods.find(m =>
                        prev.includes(m.id) && m.method_type === 'CARD_TERMINAL'
                    )
                    if (existingTerminal) {
                        toast.warning("Solo se puede seleccionar 1 TERMINAL DE COBRO por terminal POS.")
                        return prev
                    }
                }
                return [...prev, methodId]
            }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // Derive default treasury account from selected CASH method
        const selectedCashMethod = allMethods.find(m =>
            selectedMethodIds.includes(m.id) && m.method_type === 'CASH'
        )
        const defaultAccount = selectedCashMethod ? selectedCashMethod.treasury_account : null

        const payload = {
            name,
            code,
            location,
            serial_number: serialNumber || "", // Use empty string for CharField
            ip_address: ipAddress || null,     // null is fine for GenericIPAddressField
            allowed_payment_method_ids: selectedMethodIds,
            default_treasury_account: defaultAccount
        }

        try {
            if (terminal) {
                await api.patch(`/treasury/pos-terminals/${terminal.id}/`, payload)
                toast.success("Terminal actualizado")
            } else {
                await api.post('/treasury/pos-terminals/', payload)
                toast.success("Terminal creado")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            const err = error as any
            console.error("Error saving terminal:", err.response?.data || err)
            toast.error("Error al guardar terminal")
        } finally {
            setLoading(false)
        }
    }

    // Group methods for the UI form
    const methodsGrouped = allMethods.reduce((acc, method) => {
        const type = method.method_type
        if (!acc[type]) acc[type] = []
        acc[type].push(method)
        return acc
    }, {} as Record<string, PaymentMethod[]>)

    // Order of groups
    const typeOrder = ['CASH', 'CARD_TERMINAL', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'CASH': 'Efectivo (Cajas)',
            'CARD': 'Tarjetas Propias',
            'CARD_TERMINAL': 'Terminales de Cobro (Transbank/Otros)',
            'TRANSFER': 'Transferencias',
            'CHECK': 'Cheques',
            'OTHER': 'Otros'
        }
        return labels[type] || type
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={terminal ? "xl" : "lg"}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MonitorSmartphone className="h-5 w-5 text-primary" />
                    </div>
                    <span>{terminal ? "Ficha de Terminal" : "Nuevo Terminal"}</span>
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {terminal?.code && (
                        <>
                            <span>{terminal.code}</span>
                            <span className="opacity-30">|</span>
                        </>
                    )}
                    <span>{terminal ? "Modifique la configuración del terminal y revise su historial." : "Configuración del terminal y asignación de métodos de pago."}</span>
                </div>
            }
            hideScrollArea={true}
            className="h-[90vh]"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="terminal-form" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Terminal
                    </Button>
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                {/* Left Side: Form */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                    <form id="terminal-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Nombre <span className="text-red-500">*</span></Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja 1" required className={FORM_STYLES.input} />
                            </div>
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Código <span className="text-red-500">*</span></Label>
                                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="TERM-01" required className={cn(FORM_STYLES.input, "uppercase")} />
                            </div>
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Ubicación</Label>
                                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Entrada" className={FORM_STYLES.input} />
                            </div>
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>IP (Opcional)</Label>
                                <Input value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="192.168.1.100" className={FORM_STYLES.input} />
                            </div>
                        </div>

                        <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                            <div className="flex justify-between items-center">
                                <Label className={cn(FORM_STYLES.label, "mb-0")}>Métodos de Pago Permitidos</Label>
                                <Badge variant="outline" className="text-[10px] bg-white">
                                    {selectedMethodIds.length} seleccionados
                                </Badge>
                            </div>

                            <div className="space-y-5">
                                {typeOrder.map(type => {
                                    const groupMethods = methodsGrouped[type] || []
                                    if (groupMethods.length === 0) return null

                                    return (
                                        <div key={type} className="space-y-2">
                                            <h4 className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2 border-b pb-1">
                                                {type === 'CASH' && <Banknote className="h-3.5 w-3.5" />}
                                                {type === 'CARD' && <CreditCard className="h-3.5 w-3.5" />}
                                                {type === 'TRANSFER' && <Landmark className="h-3.5 w-3.5 text-indigo-500" />}
                                                {getTypeLabel(type)}
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {groupMethods.map(method => {
                                                    const isSelected = selectedMethodIds.includes(method.id)
                                                    return (
                                                        <div
                                                            key={method.id}
                                                            onClick={() => toggleMethod(method.id)}
                                                            className={`
                                                                flex items-start space-x-2 p-2 rounded-lg border cursor-pointer transition-all
                                                                ${isSelected
                                                                    ? 'bg-primary/5 border-primary/30 shadow-sm'
                                                                    : 'bg-white border-transparent hover:border-gray-200'
                                                                }
                                                            `}
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleMethod(method.id)}
                                                                className="mt-0.5"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold">{method.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    Cuenta: {method.treasury_account_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right Side: Activity Sidebar */}
                {terminal?.id && (
                    <div className="w-[350px] flex flex-col bg-muted/10 border-l overflow-hidden hidden lg:flex">
                        <ActivitySidebar
                            entityType="terminal"
                            entityId={terminal.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}

export default TerminalManagement
