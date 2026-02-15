"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CashContainerSelector } from "@/components/selectors/CashContainerSelector"
import { PaymentMethodSelector } from "@/components/shared/PaymentMethodSelector"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeftRight,
    ArrowDownLeft,
    ArrowUpRight,
    Loader2,
    AlertTriangle,
    Banknote,
    CreditCard,
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"
import { cn, formatCurrency } from "@/lib/utils"

interface CashMovementModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

// Maps to UI tabs, but backend expects INBOUND/OUTBOUND/TRANSFER
type TabType = 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL'

export function CashMovementModal({ open, onOpenChange, onSuccess }: CashMovementModalProps) {
    const [tab, setTab] = useState<TabType>('TRANSFER')
    const [amount, setAmount] = useState("")
    const [fromId, setFromId] = useState<string>("")
    const [toId, setToId] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [motive, setMotive] = useState<string>("")
    const [submitting, setSubmitting] = useState(false)
    const [paymentMethodNew, setPaymentMethodNew] = useState<string>("")
    const [availableMethods, setAvailableMethods] = useState<any[]>([])

    // Fund validation states
    const [selectedFromAccount, setSelectedFromAccount] = useState<any>(null)
    const [insufficientFunds, setInsufficientFunds] = useState(false)

    const handleReset = () => {
        setAmount("")
        setFromId("")
        setToId("")
        setNotes("")
        setMotive("")
        setSelectedFromAccount(null)
        setInsufficientFunds(false)
        setPaymentMethodNew("")
    }

    // Fetch selected account for transfer/withdrawal validation
    useEffect(() => {
        if (fromId && (tab === 'TRANSFER' || tab === 'WITHDRAWAL')) {
            api.get(`/treasury/accounts/${fromId}/`)
                .then(res => {
                    setSelectedFromAccount(res.data)
                    // Validate if account has sufficient funds
                    const needed = parseFloat(amount) || 0
                    const available = res.data.current_balance || 0
                    // Only warn for Cash accounts if we want to be strict, but Balance is generic.
                    setInsufficientFunds(needed > 0 && available < needed)
                })
                .catch(err => {
                    console.error("Failed to load account", err)
                    setSelectedFromAccount(null)
                    setInsufficientFunds(false)
                })
        } else {
            setSelectedFromAccount(null)
            setInsufficientFunds(false)
        }
    }, [fromId, tab, amount])

    // Fetch methods for the relevant account (Only for non-Withdrawal tabs where we select Account first)
    useEffect(() => {
        if (tab === 'WITHDRAWAL') {
            // For Withdrawal, the PaymentMethodSelector handles fetching and setting methods.
            // We might still want 'availableMethods' for validation or type inference if needed,
            // but strictly speaking, the selector drives the state.
            // However, to make the 'methodType' inference work in the render, we need 'availableMethods' to contain the method details...
            // BUT, the selector has its own list. 
            // To solve the "controlled component" value issue:
            // We can just rely on the fact that we set paymentMethodNew.
            // But we need the 'method_type' for the Selector's 'value' prop.
            // We can fetch a SINGLE method details if paymentMethodNew is set, OR fetch all 'purchases' methods here too.
            // Let's fetch all 'purchases' methods when in WITHDRAWAL mode so we can lookup the type.
            api.get('/treasury/payment_methods/', { params: { is_active: true, allow_for_purchases: true } })
                .then(res => {
                    const methods = res.data.results || res.data
                    setAvailableMethods(methods)
                })
                .catch(console.error)
            return
        }

        const targetAccId = tab === 'DEPOSIT' || tab === 'TRANSFER' ? toId : fromId
        if (targetAccId) {
            api.get(`/treasury/accounts/${targetAccId}/`)
                .then(res => {
                    setAvailableMethods(res.data.payment_methods || [])
                    // Set default method if only one or if CASH exists (only for native Account selection)
                    if (res.data.payment_methods?.length > 0) {
                        const cashMethod = res.data.payment_methods.find((m: any) => m.method_type === 'CASH')
                        setPaymentMethodNew(cashMethod ? cashMethod.id.toString() : res.data.payment_methods[0].id.toString())
                    } else {
                        setPaymentMethodNew("")
                    }
                })
        } else {
            setAvailableMethods([])
            setPaymentMethodNew("")
        }
    }, [fromId, toId, tab])

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("El monto debe ser mayor a cero")
            return
        }

        if (tab === 'TRANSFER' && (!fromId || !toId)) {
            toast.error("Debe especificar origen y destino para el traspaso")
            return
        }
        if (tab === 'TRANSFER' && fromId === toId) {
            toast.error("La cuenta de origen y destino no pueden ser la misma")
            return
        }
        if (tab === 'DEPOSIT' && !toId) {
            toast.error("Debe especificar la cuenta de destino")
            return
        }
        if (tab === 'WITHDRAWAL' && !fromId) {
            toast.error("Debe especificar la cuenta de origen")
            return
        }
        if ((tab === 'DEPOSIT' || tab === 'WITHDRAWAL') && !motive) {
            toast.error("Debe seleccionar un motivo")
            return
        }

        // Map Tab to Backend Type
        let movement_type = 'TRANSFER'
        if (tab === 'DEPOSIT') movement_type = 'INBOUND'
        if (tab === 'WITHDRAWAL') movement_type = 'OUTBOUND'

        setSubmitting(true)
        try {
            await api.post('/treasury/movements/', { // Use new endpoint
                movement_type: movement_type,
                amount: parseFloat(amount),
                from_account: fromId || null,
                to_account: toId || null,
                notes: notes,
                justify_reason: motive,
                payment_method_new: paymentMethodNew || null,
                payment_method: 'CASH', // Keep for backward compatibility until fully removed
            })
            toast.success("Movimiento registrado correctamente")
            handleReset()
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar movimiento")
            console.error(error)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Nuevo Movimiento de Tesorería"
            description="Registre traspasos, depósitos o retiros manuales."
            size="lg"
            footer={
                <div className="flex w-full gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || insufficientFunds}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar Movimiento
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Tabs value={tab} onValueChange={(v) => {
                    setTab(v as TabType)
                    if (v === 'DEPOSIT') {
                        setFromId("")
                        setMotive("")
                    }
                    if (v === 'WITHDRAWAL') {
                        setToId("")
                        setMotive("")
                    }
                    if (v === 'TRANSFER') {
                        setMotive("")
                    }
                }} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                        <TabsTrigger value="TRANSFER" className="gap-2">
                            <ArrowLeftRight className="h-4 w-4" /> Traspaso
                        </TabsTrigger>
                        <TabsTrigger value="DEPOSIT" className="gap-2">
                            <ArrowDownLeft className="h-4 w-4" /> Depósito
                        </TabsTrigger>
                        <TabsTrigger value="WITHDRAWAL" className="gap-2">
                            <ArrowUpRight className="h-4 w-4" /> Retiro
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

                        <div className="grid grid-cols-1 gap-4 pt-2">
                            {/* Origin */}
                            <div className={cn("space-y-2", tab === 'DEPOSIT' && "opacity-40 pointer-events-none hidden")}>
                                <Label className={FORM_STYLES.label}>
                                    {tab === 'TRANSFER' ? 'Cuenta de Origen (Sale)' : 'Cuenta de Origen / Medio de Pago'}
                                </Label>

                                {tab === 'WITHDRAWAL' ? (
                                    <PaymentMethodSelector
                                        value={{
                                            methodType: (availableMethods.find(m => m.id.toString() === paymentMethodNew)?.method_type as any) || null,
                                            treasuryAccountId: fromId || null,
                                            paymentMethodId: paymentMethodNew || null
                                        }}
                                        onChange={(val) => {
                                            setFromId(val.treasuryAccountId || "")
                                            setPaymentMethodNew(val.paymentMethodId || "")
                                            // availableMethods state is currently derived from account. 
                                            // When using PaymentSelector, we are going reverse: Method -> Account.
                                            // So we should probably update availableMethods so the type inference works? 
                                            // Actually, the selector fetches its own methods.
                                            // We need to sync the Modal's 'paymentMethodNew' and 'fromId' with the selector.

                                            // Issue: The modal's `useEffect` at line 91 watches `fromId` and fetches methods to set `availableMethods`.
                                            // If we set `fromId` here, that effect will run and might overwrite `paymentMethodNew` (line 100 sets default).
                                            // We need to prevent that effect from overwriting if we just set it via selector.

                                            // We'll handle this by adding a flag or modifying the effect.
                                        }}
                                        operation="purchases" // Withdrawals behave like purchases (money out)
                                        className="mb-2"
                                    />
                                ) : (
                                    <CashContainerSelector
                                        value={fromId}
                                        onChange={(val) => setFromId(val || "")}
                                        placeholder={tab === 'DEPOSIT' ? "Exterior / Aporte" : "Seleccione cuenta..."}
                                        disabled={tab === 'DEPOSIT'}
                                        physicalOnly={false}
                                    />
                                )}
                            </div>

                            {/* Destination */}
                            <div className={cn("space-y-2", tab === 'WITHDRAWAL' && "opacity-40 pointer-events-none hidden")}>
                                <Label className={FORM_STYLES.label}>
                                    {tab === 'TRANSFER' ? 'Cuenta de Destino (Entra)' : 'Cuenta de Destino'}
                                </Label>
                                <CashContainerSelector
                                    value={toId}
                                    onChange={(val) => setToId(val || "")}
                                    placeholder={tab === 'WITHDRAWAL' ? "Gasto / Retiro" : "Seleccione cuenta..."}
                                    disabled={tab === 'WITHDRAWAL'}
                                    physicalOnly={false}
                                />
                            </div>
                        </div>

                        {/* Motive Selector (Only for Deposit/Withdrawal) */}
                        {tab !== 'TRANSFER' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <Label className={FORM_STYLES.label}>Motivo</Label>
                                <Select value={motive} onValueChange={setMotive}>
                                    <SelectTrigger className={FORM_STYLES.input}>
                                        <SelectValue placeholder="Seleccione motivo principal..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tab === 'DEPOSIT' ? (
                                            <>
                                                <SelectItem value="TIP">Propina (Ingreso)</SelectItem>
                                                <SelectItem value="COUNTING_ERROR">Error de Conteo (Sobrante)</SelectItem>
                                                <SelectItem value="SYSTEM_ERROR">Error de Sistema (Ajuste)</SelectItem>
                                                <SelectItem value="OTHER_IN">Otro Depósito (Varios)</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                                <SelectItem value="THEFT">Robo / Pérdida</SelectItem>
                                                <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                <SelectItem value="CASHBACK">Vuelto Incorrecto</SelectItem>
                                                <SelectItem value="COUNTING_ERROR">Error de Conteo (Faltante)</SelectItem>
                                                <SelectItem value="SYSTEM_ERROR">Error de Sistema (Ajuste)</SelectItem>
                                                <SelectItem value="OTHER_OUT">Otro Egreso (Gastos Varios)</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Payment Method Selector (For legacy/Deposit/Transfer flows) */}
                        {availableMethods.length > 0 && tab !== 'WITHDRAWAL' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <Label className={FORM_STYLES.label}>
                                    {tab === 'TRANSFER' ? 'Canal de Traspaso / Método' : 'Método de Pago'}
                                </Label>
                                <Select value={paymentMethodNew} onValueChange={setPaymentMethodNew}>
                                    <SelectTrigger className={cn(FORM_STYLES.input, "border-primary/20 bg-primary/5")}>
                                        <SelectValue placeholder="Seleccione método..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMethods.map((m) => (
                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="h-3 w-3" />
                                                    {m.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Notas / Observaciones</Label>
                            <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Detalles adicionales..."
                                className="resize-none"
                            />
                        </div>

                        {/* Insufficient funds warning */}
                        {insufficientFunds && selectedFromAccount && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-red-700 dark:text-red-300">
                                        <div className="font-bold">Fondos Insuficientes</div>
                                        <div className="text-xs mt-1 space-y-0.5">
                                            <div>Disponible en {selectedFromAccount.name}: {formatCurrency(selectedFromAccount.current_balance || 0)}</div>
                                            <div>Necesario: {formatCurrency(parseFloat(amount) || 0)}</div>
                                            <div className="font-semibold">Faltante: {formatCurrency((parseFloat(amount) || 0) - (selectedFromAccount.current_balance || 0))}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Tabs>
            </div>
        </BaseModal>
    )
}

export default CashMovementModal
