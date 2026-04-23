"use client"

import { showApiError } from "@/lib/errors"
import React, { useEffect, useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { CancelButton, SubmitButton } from "@/components/shared"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { Partner } from "@/features/contacts/types/partner"
import { TreasuryAccount } from "@/features/treasury/types"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
    Info,
    Loader2,
    ArrowRightLeft,
    TrendingUp,
    AlertTriangle,
    Banknote
} from "lucide-react"

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialPartnerId?: string
    initialAmount?: string
}

export function SubscriptionMovementModal({ open, onOpenChange, onSuccess, initialPartnerId, initialAmount }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const [showConfirm, setShowConfirm] = useState(false)
    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        type: "SUBSCRIPTION" as "SUBSCRIPTION" | "REDUCTION",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })

    const resetForm = () => {
        setFormData({
            contact_id: "",
            amount: "",
            type: "SUBSCRIPTION",
            date: new Date().toISOString().split('T')[0],
            description: ""
        })
    }

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)

            if (initialPartnerId || initialAmount) {
                setFormData(prev => ({
                    ...prev,
                    contact_id: initialPartnerId || "",
                    amount: initialAmount || "",
                    description: initialAmount ? `Formalización de exceso de capital: ${formatCurrency(parseFloat(initialAmount))}` : ""
                }))
            } else {
                resetForm()
            }
        }
    }, [open, initialPartnerId, initialAmount])

    // Selected partner info
    const selectedPartner = partners.find(p => p.id.toString() === formData.contact_id)
    const subscribedCapital = Number(selectedPartner?.partner_total_contributions || 0)
    const isReduction = formData.type === "REDUCTION"
    const amountNum = parseFloat(formData.amount) || 0
    const exceedsCapital = isReduction && amountNum > subscribedCapital

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        if (exceedsCapital) {
            toast.error(`El monto de reducción excede el capital suscrito del socio (${formatCurrency(subscribedCapital)}).`)
            return
        }

        // For reductions, show confirmation dialog
        if (isReduction && !showConfirm) {
            setShowConfirm(true)
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordSubscription({
                contact_id: parseInt(formData.contact_id),
                amount: parseFloat(formData.amount),
                type: formData.type,
                date: formData.date,
                description: formData.description
            })
            toast.success("Movimiento de capital registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar suscripción")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}
                size="md"
                title={
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Modificación de Capital
                    </div>
                }
                description="Registre un cambio formal en la participación societaria. Esto afecta el capital suscrito y el saldo por enterar del socio."
                footer={
                    <div className="flex w-full gap-3 justify-end">
                        <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                        <SubmitButton onClick={handleSubmit} disabled={exceedsCapital} loading={loading}>
                            Confirmar Movimiento
                        </SubmitButton>
                    </div>
                }
            >
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="partner">Socio</Label>
                        <Select
                            value={formData.contact_id}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione un socio" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Show selected partner's current capital */}
                    {selectedPartner && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">Capital Suscrito Actual</span>
                                <span className="font-mono font-bold text-primary">{formatCurrency(subscribedCapital)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">Participación Actual</span>
                                <span className="font-bold">{selectedPartner.partner_equity_percentage}%</span>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="type">Tipo de Movimiento</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(v: "SUBSCRIPTION" | "REDUCTION") => setFormData(prev => ({ ...prev, type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SUBSCRIPTION">Aumento de Capital (Suscripción)</SelectItem>
                                <SelectItem value="REDUCTION">Reducción de Capital</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto ($)</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                        />
                        {isReduction && selectedPartner && amountNum > 0 && (
                            <p className={`text-[10px] font-medium ${exceedsCapital ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {exceedsCapital
                                    ? `⚠ Excede el capital suscrito (${formatCurrency(subscribedCapital)})`
                                    : `Capital resultante: ${formatCurrency(subscribedCapital - amountNum)}`
                                }
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción / Motivo</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Aporte por expansión 2026"
                        />
                    </div>
                </div>
            </BaseModal>

            {/* Confirmation dialog for reductions */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="h-5 w-5" />
                            Confirmar Reducción de Capital
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>Está a punto de reducir el capital suscrito de <strong>{selectedPartner?.name}</strong> por <strong>{formatCurrency(amountNum)}</strong>.</p>
                            <p>Esta operación genera un asiento contable reversando Capital Social. ¿Desea continuar?</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSubmit}
                            className="bg-warning hover:bg-warning/90"
                        >
                            Sí, Reducir Capital
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export function EquityTransferModal({ open, onOpenChange, onSuccess }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const [showConfirm, setShowConfirm] = useState(false)
    const [formData, setFormData] = useState({
        from_contact_id: "",
        to_contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })

    const resetForm = () => {
        setFormData({
            from_contact_id: "",
            to_contact_id: "",
            amount: "",
            date: new Date().toISOString().split('T')[0],
            description: ""
        })
    }

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
            resetForm()
        }
    }, [open])

    // Seller info
    const seller = partners.find(p => p.id.toString() === formData.from_contact_id)
    const buyer = partners.find(p => p.id.toString() === formData.to_contact_id)
    const sellerCapital = Number(seller?.partner_total_contributions || 0)
    const amountNum = parseFloat(formData.amount) || 0
    const exceedsCapital = amountNum > sellerCapital && sellerCapital > 0

    const handleSubmit = async () => {
        if (!formData.from_contact_id || !formData.to_contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        if (formData.from_contact_id === formData.to_contact_id) {
            toast.error("El socio de origen y destino no pueden ser el mismo.")
            return
        }

        if (exceedsCapital) {
            toast.error(`El monto excede el capital suscrito del vendedor (${formatCurrency(sellerCapital)}).`)
            return
        }

        // Show confirmation dialog
        if (!showConfirm) {
            setShowConfirm(true)
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordTransfer({
                from_contact_id: parseInt(formData.from_contact_id),
                to_contact_id: parseInt(formData.to_contact_id),
                amount: parseFloat(formData.amount),
                date: formData.date,
                description: formData.description
            })
            toast.success("Transferencia de participación registrada exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar transferencia")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}
                size="md"
                title={
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        Transferencia de Participación
                    </div>
                }
                description="Mueva capital suscrito de un socio existente a otro nuevo o actual."
                footer={
                    <div className="flex w-full gap-3 justify-end">
                        <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                        <SubmitButton onClick={handleSubmit} disabled={exceedsCapital} loading={loading}>
                            Registrar Transferencia
                        </SubmitButton>
                    </div>
                }
            >
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Socio que Transfiere (Vende)</Label>
                        <Select
                            value={formData.from_contact_id}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, from_contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Socio de origen" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {seller && (
                            <p className="text-[10px] text-muted-foreground font-medium">
                                Capital suscrito: <span className="font-mono font-bold text-primary">{formatCurrency(sellerCapital)}</span> — Participación: <span className="font-bold">{seller.partner_equity_percentage}%</span>
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2 font-bold text-center text-muted-foreground">
                        <ArrowRightLeft className="mx-auto h-4 w-4" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Socio que Recibe (Compra)</Label>
                        <Select
                            value={formData.to_contact_id}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, to_contact_id: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Socio de destino" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {buyer && (
                            <p className="text-[10px] text-muted-foreground font-medium">
                                Capital actual: <span className="font-mono font-bold">{formatCurrency(buyer.partner_total_contributions || 0)}</span> — Participación: <span className="font-bold">{buyer.partner_equity_percentage}%</span>
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto Capital Transferido ($)</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                        />
                        {seller && amountNum > 0 && (
                            <p className={`text-[10px] font-medium ${exceedsCapital ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {exceedsCapital
                                    ? `⚠ Excede el capital suscrito del vendedor (${formatCurrency(sellerCapital)})`
                                    : `Capital restante del vendedor: ${formatCurrency(sellerCapital - amountNum)}`
                                }
                            </p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Fecha de la Transacción</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción / Motivo</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Venta de acciones según acta Nº 45"
                        />
                    </div>
                </div>
            </BaseModal>

            {/* Confirmation dialog for transfers */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-primary">
                            <ArrowRightLeft className="h-5 w-5" />
                            Confirmar Transferencia de Capital
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>Está a punto de transferir <strong>{formatCurrency(amountNum)}</strong> de capital suscrito:</p>
                            <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/50 text-sm font-medium">
                                <span>{seller?.name}</span>
                                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                                <span>{buyer?.name}</span>
                            </div>
                            <p>Esto modificará los porcentajes de participación y generará un asiento contable reclasificando el capital suscrito y los saldos pendientes entre los socios involucrados. ¿Desea continuar?</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSubmit}
                            className="bg-primary hover:bg-primary"
                        >
                            Sí, Transferir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function useTreasuryAccounts() {
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])

    useEffect(() => {
        // Fetch treasury accounts for the dropdowns
        import("@/lib/api").then(m => m.default).then(async (api) => {
            try {
                const res = await api.get<TreasuryAccount[]>('/treasury/accounts/')
                setAccounts(res.data)
            } catch (error) {
                console.error("Error fetching treasury accounts:", error)
            }
        })
    }, [])

    return accounts
}

export function CapitalContributionModal({ open, onOpenChange, onSuccess }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const treasuryAccounts = useTreasuryAccounts()

    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        treasury_account_id: "",
        description: ""
    })

    const resetForm = () => {
        setFormData({
            contact_id: "",
            amount: "",
            date: new Date().toISOString().split('T')[0],
            treasury_account_id: "",
            description: ""
        })
    }

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
            resetForm()
        }
    }, [open])

    const selectedPartner = partners.find(p => p.id.toString() === formData.contact_id)
    const pendingCapital = selectedPartner ? Number(selectedPartner.partner_pending_capital) || 0 : 0

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount || !formData.treasury_account_id) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.createTransaction(parseInt(formData.contact_id), {
                transaction_type: 'CAPITAL_CASH',
                amount: parseFloat(formData.amount),
                date: formData.date,
                treasury_account_id: parseInt(formData.treasury_account_id),
                description: formData.description
            })
            toast.success("Aporte efectivo registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar aporte")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                    Aporte de Capital Efectivo
                </div>
            }
            description="Ingrese el capital en efectivo o transferencia a una cuenta de tesorería."
            footer={
                <div className="flex w-full gap-3 justify-end">
                    <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                    <SubmitButton onClick={handleSubmit} loading={loading}>
                        Registrar Aporte
                    </SubmitButton>
                </div>
            }
        >
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label>Socio Aportante</Label>
                    <Select value={formData.contact_id} onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un socio" />
                        </SelectTrigger>
                        <SelectContent>
                            {partners.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedPartner && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Capital Pendiente (por cobrar): <span className="font-mono font-bold text-success">{formatCurrency(pendingCapital)}</span>
                        </p>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label>Cuenta de Tesorería (Destino)</Label>
                    <Select value={formData.treasury_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, treasury_account_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Cuenta bancaria o caja" />
                        </SelectTrigger>
                        <SelectContent>
                            {treasuryAccounts.map(a => (
                                <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({a.identifier})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Monto Ingresado ($)</Label>
                    <Input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Fecha del Aporte</Label>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Descripción / Motivo</Label>
                    <Input
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ej: Aporte inicial o expansión"
                    />
                </div>
            </div>
        </BaseModal>
    )
}

export function ProvisionalWithdrawalModal({ open, onOpenChange, onSuccess }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const treasuryAccounts = useTreasuryAccounts()

    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        treasury_account_id: "",
        description: ""
    })

    const resetForm = () => {
        setFormData({
            contact_id: "",
            amount: "",
            date: new Date().toISOString().split('T')[0],
            treasury_account_id: "",
            description: ""
        })
    }

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
            resetForm()
        }
    }, [open])

    const selectedPartner = partners.find(p => p.id.toString() === formData.contact_id)
    const withdrawalsBalance = selectedPartner ? (parseFloat(selectedPartner.partner_provisional_withdrawals_balance) || 0) : 0

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount || !formData.treasury_account_id) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.createTransaction(parseInt(formData.contact_id), {
                transaction_type: 'PROV_WITHDRAWAL',
                amount: parseFloat(formData.amount),
                date: formData.date,
                treasury_account_id: parseInt(formData.treasury_account_id),
                description: formData.description || 'Retiro Provisorio de Utilidades'
            })
            toast.success("Retiro provisorio registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar retiro")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Registro de Retiro Provisorio
                </div>
            }
            description="Adelanto a cuenta de utilidades. Este retiro descontará caja y quedará pendiente de liquidar en el cierre anual."
            footer={
                <div className="flex w-full gap-3 justify-end">
                    <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                    <SubmitButton variant="destructive" onClick={handleSubmit} loading={loading}>
                        Confirmar Egreso
                    </SubmitButton>
                </div>
            }
        >
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label>Socio que Retira</Label>
                    <Select value={formData.contact_id} onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un socio" />
                        </SelectTrigger>
                        <SelectContent>
                            {partners.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedPartner && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Acumulado en Retiros Provisorios (Deuda del Socio): <span className="font-mono font-bold text-destructive">{formatCurrency(withdrawalsBalance)}</span>
                        </p>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label>Cuenta de Tesorería (Origen)</Label>
                    <Select value={formData.treasury_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, treasury_account_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Cuenta bancaria o caja" />
                        </SelectTrigger>
                        <SelectContent>
                            {treasuryAccounts.map(a => (
                                <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({a.identifier})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Monto a Retirar ($)</Label>
                    <Input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Fecha del Retiro</Label>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Descripción / Motivo</Label>
                    <Input
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ej: Adelanto utilidades Octubre"
                    />
                </div>
            </div>
        </BaseModal>
    )
}


export function DividendPaymentModal({ open, onOpenChange, onSuccess, initialPartnerId }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const treasuryAccounts = useTreasuryAccounts()

    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        treasury_account_id: "",
        description: ""
    })

    const resetForm = () => {
        setFormData({
            contact_id: "",
            amount: "",
            date: new Date().toISOString().split('T')[0],
            treasury_account_id: "",
            description: ""
        })
    }

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(setPartners)
            if (initialPartnerId) {
                setFormData(prev => ({ ...prev, contact_id: initialPartnerId }))
            } else {
                resetForm()
            }
        }
    }, [open, initialPartnerId])

    const selectedPartner = partners.find(p => p.id.toString() === formData.contact_id)
    const dividendBalance = selectedPartner ? (parseFloat(selectedPartner.partner_dividends_payable_balance) || 0) : 0
    const amountNum = parseFloat(formData.amount) || 0
    const isOverflow = amountNum > dividendBalance

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount || !formData.treasury_account_id) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordDividendPayment(parseInt(formData.contact_id), {
                amount: amountNum,
                date: formData.date,
                treasury_account_id: parseInt(formData.treasury_account_id),
                description: formData.description
            })
            toast.success("Pago de dividendos registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar pago de dividendos")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-primary" />
                    Pago de Dividendos
                </div>
            }
            description="Registre la salida de fondos para el pago de utilidades decretadas."
            footer={
                <div className="flex w-full gap-3 justify-end">
                    <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                    <SubmitButton onClick={handleSubmit} disabled={!formData.amount} loading={loading}>
                        Confirmar Pago
                    </SubmitButton>
                </div>
            }
        >
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label>Socio Receptor</Label>
                    <Select value={formData.contact_id} onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un socio" />
                        </SelectTrigger>
                        <SelectContent>
                            {partners.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedPartner && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Saldo de Dividendos por Pagar: <span className="font-mono font-bold text-primary">{formatCurrency(dividendBalance)}</span>
                        </p>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label>Cuenta de Tesorería (Origen)</Label>
                    <Select value={formData.treasury_account_id} onValueChange={(v) => setFormData(prev => ({ ...prev, treasury_account_id: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Cuenta bancaria o caja" />
                        </SelectTrigger>
                        <SelectContent>
                            {treasuryAccounts.map(a => (
                                <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({a.identifier})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Monto a Pagar ($)</Label>
                    <Input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                    />
                    {isOverflow && (
                        <Alert className="py-2 px-3 bg-warning/10 border-warning/20">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <AlertDescription className="text-[9px] text-warning leading-tight">
                                El monto excede el saldo de dividendos. El excedente de <strong>{formatCurrency(amountNum - dividendBalance)}</strong> se registrará como un <strong>Retiro Provisorio</strong>.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label>Fecha del Pago</Label>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Descripción / Notas</Label>
                    <Input
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ej: Pago dividendos ejercicio 2025"
                    />
                </div>
            </div>
        </BaseModal>
    )
}
