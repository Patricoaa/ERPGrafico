"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Calculator, Banknote, Vault, AlertTriangle, ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"
import { Numpad } from "@/components/ui/numpad"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { BaseModal } from "@/components/shared/BaseModal"
import { cn, formatCurrency } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"

interface POSSession {
    id: number
    terminal_name?: string
    treasury_account: number // Added for default destination logic
    treasury_account_name: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    expected_cash: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

interface POSSessionAudit {
    id: number
    difference: number
    expected_amount: number
    actual_amount: number
    notes: string
}

interface SessionCloseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    session: POSSession
    onSuccess?: (audit: POSSessionAudit) => void
}

export function SessionCloseModal({
    open,
    onOpenChange,
    session,
    onSuccess
}: SessionCloseModalProps) {
    // Form states
    const [actualCash, setActualCash] = useState<string>("0")
    const [withdrawalAmount, setWithdrawalAmount] = useState<string>("0")
    const [closeNotes, setCloseNotes] = useState<string>("")
    const [cashDestinationId, setCashDestinationId] = useState<string | null>(null)
    const [justifyReason, setJustifyReason] = useState<string>("")
    const [justifyTargetId, setJustifyTargetId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Sync withdrawalAmount with actualCash by default
    useEffect(() => {
        setWithdrawalAmount(actualCash)
    }, [actualCash])

    const [step, setStep] = useState(1)

    const [accountingSettings, setAccountingSettings] = useState<any>(null)

    // Pre-populate expected cash and default treasury account when modal opens
    useEffect(() => {
        if (open && session) {
            setCloseNotes("")
            setJustifyReason("")
            setJustifyTargetId(null)
            setStep(1) // Reset to step 1
            // Default destination: same treasury account as session (leave in till/safe)
            if (session.treasury_account) {
                setCashDestinationId(session.treasury_account.toString())
            } else {
                setCashDestinationId(null)
            }
        }
    }, [open, session])

    // Fetch Accounting Settings
    useEffect(() => {
        if (open) {
            api.get('/accounting/settings/current/')
                .then(res => setAccountingSettings(res.data))
                .catch(err => console.error("Failed to load accounting settings", err))
        }
    }, [open])

    const handleNext = () => setStep(p => p + 1)
    const handlePrev = () => setStep(p => p - 1)

    const handleCloseSession = async () => {
        if (!session) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${session.id}/close_session/`, {
                actual_cash: parseFloat(actualCash) || 0,
                withdrawal_amount: parseFloat(withdrawalAmount) || 0,
                notes: closeNotes,
                cash_destination_id: cashDestinationId ? parseInt(cashDestinationId) : null,
                justify_reason: justifyReason || undefined,
                justify_target_id: justifyTargetId ? parseInt(justifyTargetId) : null
            })

            const audit = response.data.audit
            const difference = parseFloat(audit.difference)

            if (difference !== 0) {
                const diffType = difference > 0 ? "sobrante" : "faltante"
                toast.warning(`Caja cerrada con ${diffType} de ${formatCurrency(Math.abs(difference))}`)
            } else {
                toast.success("Caja cerrada correctamente - Cuadra perfecto!")
            }

            // Call success callback
            onSuccess?.(audit)

            // Close modal
            onOpenChange(false)

            // Reset form
            setActualCash("0")
            setCloseNotes("")
            setJustifyReason("")
            setJustifyTargetId(null)
            setCashDestinationId(null)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cerrar caja")
        } finally {
            setSubmitting(false)
        }
    }

    const actual = parseFloat(actualCash) || 0
    const expected = session.expected_cash
    const diff = actual - expected
    const hasDiff = diff !== 0

    const renderStep = () => {
        switch (step) {
            case 1: // Count
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-4">
                            <h3 className="font-bold text-lg">Conteo de Efectivo</h3>
                            <p className="text-sm text-muted-foreground">
                                Ingrese el monto físico contado en la gaveta
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <div className="w-full max-w-sm bg-muted/30 p-4 rounded-xl">
                                <div className="text-right mb-4">
                                    <div className="text-xs font-bold uppercase text-muted-foreground">Monto Contado</div>
                                    <div className="text-3xl font-black font-mono tracking-tight text-primary">
                                        {formatCurrency(parseFloat(actualCash) || 0)}
                                    </div>
                                </div>
                                <Numpad
                                    value={actualCash}
                                    onChange={setActualCash}
                                    hideDisplay={true}
                                    allowDecimal={true}
                                    className="w-full max-w-full shadow-none border-0 p-0"
                                    onConfirm={handleNext}
                                    confirmLabel="Confirmar Conteo"
                                    onExactAmount={() => setActualCash(session.expected_cash.toString())}
                                    exactAmountLabel={`Monto Exacto (${formatCurrency(session.expected_cash)})`}
                                />
                            </div>
                        </div>

                        <div className="h-2" />
                    </div>
                )

            case 2: // Review & Difference
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <h3 className="font-bold text-lg">Resumen de Cierre</h3>
                        </div>

                        <div className="bg-card border rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Fondo en Sistema:</span>
                                <span className="font-medium">{formatCurrency(expected)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                                <span>Fondo Contado:</span>
                                <span className="text-primary">{formatCurrency(actual)}</span>
                            </div>
                        </div>

                        {hasDiff ? (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-amber-700 font-bold">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Diferencia Detectada</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>{diff > 0 ? "Sobrante" : "Faltante"}:</span>
                                    <span className="font-bold text-lg">{formatCurrency(Math.abs(diff))}</span>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Motivo (Requerido)</Label>
                                    <Select value={justifyReason} onValueChange={setJustifyReason}>
                                        <SelectTrigger className="bg-white dark:bg-black/20 h-9">
                                            <SelectValue placeholder="Seleccione motivo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {diff < 0 ? (
                                                <>
                                                    <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase bg-muted/50">Motivos de Salida (Faltante)</div>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo / Ajuste</SelectItem>
                                                    <SelectItem value="CASHBACK">Vuelto Incorrecto</SelectItem>
                                                    <SelectItem value="TRANSFER">Traspaso (Dinero retirado)</SelectItem>
                                                    {accountingSettings?.pos_partner_withdrawal_account && (
                                                        <SelectItem value="PARTNER_WITHDRAWAL">Retiro Socio</SelectItem>
                                                    )}
                                                    {accountingSettings?.pos_theft_account && (
                                                        <SelectItem value="THEFT">Faltante / Robo</SelectItem>
                                                    )}
                                                    {accountingSettings?.pos_rounding_adjustment_account && (
                                                        <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                    )}
                                                    <SelectItem value="SYSTEM_ERROR">Error de Sistema</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase bg-muted/50">Motivos de Ingreso (Sobrante)</div>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo / Ajuste</SelectItem>
                                                    <SelectItem value="TIP">Propina</SelectItem>
                                                    <SelectItem value="TRANSFER">Traspaso (Dinero ingresado)</SelectItem>
                                                    {accountingSettings?.pos_rounding_adjustment_account && (
                                                        <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                    )}
                                                    <SelectItem value="SYSTEM_ERROR">Error de Sistema</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Dynamic selector for Transfer justification */}
                                {justifyReason === 'TRANSFER' && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-xs">
                                            {diff < 0 ? 'Cuenta de Destino (¿A dónde se llevó el dinero?)' : 'Cuenta de Origen (¿De dónde vino el dinero?)'}
                                        </Label>
                                        <TreasuryAccountSelector
                                            value={justifyTargetId}
                                            onChange={setJustifyTargetId}
                                            placeholder={diff < 0 ? "Seleccione destino..." : "Seleccione origen..."}
                                            excludeId={session.treasury_account}
                                            paymentMethod="TRANSFER"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center p-6 bg-emerald-50 text-emerald-700 rounded-xl">
                                <span className="text-4xl block mb-2">✨</span>
                                <div className="font-bold">¡Cierre Perfecto!</div>
                                <div className="text-sm opacity-80">El efectivo coincide exactamente con el sistema.</div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev}>Modificar Conteo</Button>
                            <Button className="flex-1" onClick={handleNext} disabled={hasDiff && !justifyReason}>Siguiente</Button>
                        </div>
                    </div>
                )

            case 3: // Decision Step
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                <ArrowRightLeft className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-bold text-lg">Retiro o Traspaso</h3>
                            <p className="text-sm text-muted-foreground">
                                ¿Desea realizar un retiro de efectivo o traspaso de dinero a otra caja antes de cerrar?
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-center justify-center border-2 hover:border-primary hover:bg-primary/5 group"
                                onClick={() => setStep(4)}
                            >
                                <span className="font-bold">Sí, realizar retiro/traspaso</span>
                                <span className="text-xs text-muted-foreground">Configurar monto y destino</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-center justify-center border-2 hover:border-emerald-500 hover:bg-emerald-500/5 group"
                                onClick={() => {
                                    setWithdrawalAmount("0")
                                    // Use a timeout to ensure state is updated before call
                                    setTimeout(handleCloseSession, 50)
                                }}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span className="font-bold">No, cerrar sin retirar</span>
                                        <span className="text-xs text-muted-foreground">Finaliza la sesión ahora</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev} className="w-full">Volver al Resumen</Button>
                        </div>
                    </div>
                )

            case 4: // Withdrawal (Optional Step)
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <h3 className="font-bold text-lg">Configurar Retiro</h3>
                            <p className="text-sm text-muted-foreground">Ingrese el monto y el destino para el retiro</p>
                        </div>

                        <div className="p-4 bg-muted/20 rounded-xl space-y-4">
                            <div className="space-y-4">
                                <div className="text-right">
                                    <div className="text-xs font-bold uppercase text-muted-foreground">Monto a Retirar</div>
                                    <div className="text-3xl font-black font-mono tracking-tight text-primary">
                                        {formatCurrency(parseFloat(withdrawalAmount) || 0)}
                                    </div>
                                </div>
                                <Numpad
                                    value={withdrawalAmount}
                                    onChange={setWithdrawalAmount}
                                    hideDisplay={true}
                                    allowDecimal={true}
                                    className="w-full max-w-full shadow-none border-0 p-0"
                                    onConfirm={handleCloseSession}
                                    confirmLabel="Finalizar Cierre"
                                    onExactAmount={() => setWithdrawalAmount(actualCash)}
                                    exactAmountLabel={`Retirar Todo (${formatCurrency(actual)})`}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Destino</Label>
                                <TreasuryAccountSelector
                                    value={cashDestinationId}
                                    onChange={setCashDestinationId}
                                    placeholder="Seleccione destino..."
                                    paymentMethod="CASH"
                                    excludeId={session.treasury_account}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev} className="w-full">Atrás</Button>
                        </div>
                    </div>
                )
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                {renderStep()}
            </DialogContent>
        </Dialog>
    )
}
