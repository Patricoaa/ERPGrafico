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
import { Loader2, Calculator, Banknote, Vault, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"
import { CashContainerSelector } from "@/components/selectors/CashContainerSelector"
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

    // Pre-populate expected cash and default treasury account when modal opens
    useEffect(() => {
        if (open && session) {
            setActualCash(session.expected_cash.toString())
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
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                        <Button
                                            key={n}
                                            variant="outline"
                                            className="h-14 text-xl font-bold"
                                            onClick={() => setActualCash(prev => prev === "0" ? n.toString() : prev + n)}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        className="h-14 text-red-500 font-bold"
                                        onClick={() => setActualCash("0")}
                                    >C</Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 text-xl font-bold"
                                        onClick={() => setActualCash(prev => prev === "0" ? "0" : prev + "0")}
                                    >0</Button>
                                    <Button
                                        variant="ghost"
                                        className="h-14"
                                        onClick={() => setActualCash(prev => prev.slice(0, -1) || "0")}
                                    >
                                        ⌫
                                    </Button>
                                </div>
                                <Button
                                    className="w-full mt-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200"
                                    variant="outline"
                                    onClick={() => setActualCash(session.expected_cash.toString())}
                                >
                                    <Calculator className="mr-2 h-4 w-4" />
                                    Monto Exacto ({formatCurrency(session.expected_cash)})
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={handleNext} className="w-full">
                                Confirmar Conteo
                            </Button>
                        </div>
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
                                                    <SelectItem value="PARTNER_WITHDRAWAL">Retiro Socio</SelectItem>
                                                    <SelectItem value="THEFT">Faltante / Pérdida</SelectItem>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo</SelectItem>
                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo</SelectItem>
                                                    <SelectItem value="TIP">Propina</SelectItem>
                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
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

            case 3: // Withdrawal (Optional)
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <h3 className="font-bold text-lg">Retiro de Efectivo</h3>
                            <p className="text-sm text-muted-foreground">¿Desea retirar dinero de la caja?</p>
                        </div>

                        <div className="p-4 bg-muted/20 rounded-xl space-y-4">
                            <div className="space-y-2">
                                <Label>Monto a Retirar</Label>
                                <Input
                                    type="number"
                                    value={withdrawalAmount}
                                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                                    className="font-mono text-lg font-bold"
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => setWithdrawalAmount("0")}>Nada</Button>
                                    <Button size="sm" variant="outline" onClick={() => setWithdrawalAmount(actualCash)}>Todo ({formatCurrency(actual)})</Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Destino</Label>
                                <CashContainerSelector
                                    value={cashDestinationId}
                                    onChange={setCashDestinationId}
                                    placeholder="Seleccione destino..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev}>Atrás</Button>
                            <Button
                                onClick={handleCloseSession}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                disabled={submitting}
                            >
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Finalizar Cierre
                            </Button>
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
