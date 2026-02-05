"use client"

import { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CashContainerSelector } from "@/components/selectors/CashContainerSelector"
import {
    ArrowLeftRight,
    ArrowDownLeft,
    ArrowUpRight,
    Loader2,
    AlertCircle,
    Banknote,
    Calculator
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface CashMovementModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

type MovementType = 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL'

export function CashMovementModal({ open, onOpenChange, onSuccess }: CashMovementModalProps) {
    const [type, setType] = useState<MovementType>('TRANSFER')
    const [amount, setAmount] = useState("")
    const [fromId, setFromId] = useState<string>("")
    const [toId, setToId] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleReset = () => {
        setAmount("")
        setFromId("")
        setToId("")
        setNotes("")
    }

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("El monto debe ser mayor a cero")
            return
        }

        if (type === 'TRANSFER' && (!fromId || !toId)) {
            toast.error("Debe especificar origen y destino para el traspaso")
            return
        }
        if (type === 'TRANSFER' && fromId === toId) {
            toast.error("La cuenta de origen y destino no pueden ser la misma")
            return
        }
        if (type === 'DEPOSIT' && !toId) {
            toast.error("Debe especificar la cuenta de destino")
            return
        }
        if (type === 'WITHDRAWAL' && !fromId) {
            toast.error("Debe especificar la cuenta de origen")
            return
        }

        setSubmitting(true)
        try {
            await api.post('/treasury/cash-movements/', {
                movement_type: type,
                amount: parseFloat(amount),
                from_account: fromId || null,
                to_account: toId || null,
                notes: notes
            })
            toast.success("Movimiento registrado correctamente")
            handleReset()
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar movimiento")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Nuevo Movimiento de Efectivo"
            description="Registre traspasos entre cajas, depósitos externos o retiros manuales."
            size="lg"
            footer={
                <div className="flex w-full gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar Movimiento (Enter)
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Tabs value={type} onValueChange={(v) => {
                    setType(v as MovementType)
                    if (v === 'DEPOSIT') setFromId("")
                    if (v === 'WITHDRAWAL') setToId("")
                }} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                        <TabsTrigger value="TRANSFER" className="gap-2">
                            <ArrowLeftRight className="h-4 w-4" /> Traspaso
                        </TabsTrigger>
                        <TabsTrigger value="DEPOSIT" className="gap-2">
                            <ArrowDownLeft className="h-4 w-4" /> Ingreso
                        </TabsTrigger>
                        <TabsTrigger value="WITHDRAWAL" className="gap-2">
                            <ArrowUpRight className="h-4 w-4" /> Egreso
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6 space-y-4">
                        {/* Amount - Primary Input */}
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Monto del Movimiento ($)</Label>
                            <div className="relative">
                                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className={cn("pl-10 text-2xl font-bold font-mono h-14", FORM_STYLES.input)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {/* Origin */}
                            <div className={cn("space-y-2", type === 'DEPOSIT' && "opacity-40 pointer-events-none")}>
                                <Label className={FORM_STYLES.label}>
                                    {type === 'TRANSFER' ? 'Cuenta de Origen (Sale)' : 'Cuenta de Origen'}
                                </Label>
                                <CashContainerSelector
                                    value={fromId}
                                    onChange={(val) => setFromId(val || "")}
                                    placeholder={type === 'DEPOSIT' ? "Exterior / Aporte" : "Seleccione caja..."}
                                    disabled={type === 'DEPOSIT'}
                                />
                            </div>

                            {/* Destination */}
                            <div className={cn("space-y-2", type === 'WITHDRAWAL' && "opacity-40 pointer-events-none")}>
                                <Label className={FORM_STYLES.label}>
                                    {type === 'TRANSFER' ? 'Cuenta de Destino (Entra)' : 'Cuenta de Destino'}
                                </Label>
                                <CashContainerSelector
                                    value={toId}
                                    onChange={(val) => setToId(val || "")}
                                    placeholder={type === 'WITHDRAWAL' ? "Gasto / Retiro" : "Seleccione caja..."}
                                    disabled={type === 'WITHDRAWAL'}
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Motivo / Observaciones</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Describa brevemente el motivo del movimiento..."
                                className={cn("resize-none", FORM_STYLES.input)}
                                rows={3}
                            />
                        </div>

                        {/* Info Alert */}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
                            <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                <strong>Nota Contable:</strong> Al registrar este movimiento, el sistema generará automáticamente
                                el asiento contable correspondiente basado en el tipo de operación y las cuentas involucradas.
                            </div>
                        </div>
                    </div>
                </Tabs>
            </div>
        </BaseModal>
    )
}
