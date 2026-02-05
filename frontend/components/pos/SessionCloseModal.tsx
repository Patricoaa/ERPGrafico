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

    // Pre-populate expected cash and default treasury account when modal opens
    useEffect(() => {
        if (open && session) {
            setActualCash(session.expected_cash.toString())
            setCloseNotes("")
            setJustifyReason("")
            setJustifyTargetId(null)
            // Default destination: same treasury account as session (leave in till/safe)
            if (session.treasury_account) {
                setCashDestinationId(session.treasury_account.toString())
            } else {
                setCashDestinationId(null)
            }
        }
    }, [open, session])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && open) {
                const actual = parseFloat(actualCash) || 0
                const expected = session.expected_cash
                const diff = actual - expected
                const hasDiff = diff !== 0

                if (!(hasDiff && !justifyReason)) {
                    handleCloseSession()
                }
            }
        }

        if (open) {
            window.addEventListener("keydown", handleKeyDown)
            return () => window.removeEventListener("keydown", handleKeyDown)
        }
    }, [open, actualCash, justifyReason, session])

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

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={`Cierre de Caja${session.terminal_name ? ` - ${session.terminal_name}` : ''}`}
            description="Verifique los montos y confirme el cierre."
            size="xl"
            footer={
                <div className="flex w-full gap-2 sm:justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCloseSession}
                        disabled={submitting || (hasDiff && !justifyReason)}
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Cerrar Caja
                    </Button>
                </div>
            }
        >
            <div className={`grid gap-6 ${hasDiff ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                {/* Col 1: Resumen */}
                <Card className={cn("h-full", FORM_STYLES.card)}>
                    <CardHeader className="pb-2">
                        <CardTitle className={FORM_STYLES.label}>
                            Resumen de Sesión
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <div className="flex justify-between py-1 border-b border-dashed">
                                    <span>Fondo Inicial</span>
                                    <span className="font-mono">{formatCurrency(session.opening_balance)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-dashed">
                                    <span>Ventas Efectivo</span>
                                    <span className="font-mono text-emerald-600">+{formatCurrency(session.total_cash_sales)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                    <span>Ventas Tarjeta</span>
                                    <span className="font-mono">{formatCurrency(session.total_card_sales)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                    <span>Ventas Transferencia</span>
                                    <span className="font-mono">{formatCurrency(session.total_transfer_sales)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                    <span>Ventas Crédito</span>
                                    <span className="font-mono">{formatCurrency(session.total_credit_sales)}</span>
                                </div>

                                {(session.total_other_cash_inflow > 0 || session.total_other_cash_outflow > 0) && (
                                    <div className="flex justify-between py-1 border-b border-dashed">
                                        <span>Otros Movimientos</span>
                                        <div className="text-right font-mono text-xs">
                                            {session.total_other_cash_inflow > 0 && <span className="text-emerald-600 block">+{formatCurrency(session.total_other_cash_inflow)}</span>}
                                            {session.total_other_cash_outflow > 0 && <span className="text-red-600 block">-{formatCurrency(session.total_other_cash_outflow)}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pt-4 border-t mt-auto">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>Esperado</span>
                                <span className="text-primary">{formatCurrency(expected)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Col 2: Conteo Físico */}
                <Card className={cn("h-full", FORM_STYLES.card)}>
                    <CardHeader className="pb-2">
                        <CardTitle className={FORM_STYLES.label}>
                            Conteo de Efectivo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Efectivo en Gaveta ($)</Label>
                            <div className="relative">
                                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    value={actualCash}
                                    onChange={(e) => setActualCash(e.target.value)}
                                    placeholder="0"
                                    className={cn("pl-10 text-2xl font-black h-14 font-mono", FORM_STYLES.input)}
                                    autoFocus
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActualCash(expected.toString())}
                                className="w-full mt-2 text-[10px] h-7 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                            >
                                <Calculator className="h-3 w-3" />
                                Cuadra Perfecto
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Col 3: Diferencia y Justificación */}
                {hasDiff && (
                    <Card className={cn("h-full border-l-4 shadow-sm", diff > 0 ? "border-l-blue-500" : "border-l-amber-500")}>
                        <CardHeader className={cn("pb-3", diff > 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-amber-50 dark:bg-amber-950/20")}>
                            <CardTitle className={cn("flex items-center gap-2 text-sm", diff > 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400")}>
                                <AlertTriangle className="h-4 w-4" />
                                Diferencia Detallada
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className={cn("text-center p-3 rounded-lg", diff > 0 ? "bg-blue-50 dark:bg-blue-950/10" : "bg-amber-50 dark:bg-amber-950/10")}>
                                <div className={cn("text-[10px] font-bold uppercase", diff > 0 ? "text-blue-600" : "text-amber-600")}>
                                    {diff > 0 ? 'SOBRANTE' : 'FALTANTE'}
                                </div>
                                <div className={cn("text-2xl font-black font-mono", diff > 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400")}>
                                    {formatCurrency(Math.abs(diff))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Motivo de la Diferencia</Label>
                                    <Select value={justifyReason} onValueChange={setJustifyReason}>
                                        <SelectTrigger className={FORM_STYLES.input}>
                                            <SelectValue placeholder="Seleccione razón..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {diff < 0 ? (
                                                <>
                                                    <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                                    <SelectItem value="TRANSFER">Traspaso Enviado (No Reg.)</SelectItem>
                                                    <SelectItem value="THEFT">Robo / Faltante</SelectItem>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo</SelectItem>
                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                    <SelectItem value="OTHER_OUT">Otro Egreso</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="TRANSFER">Traspaso Recibido (No Reg.)</SelectItem>
                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo / Sobrante</SelectItem>
                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                    <SelectItem value="TIP">Propina</SelectItem>
                                                    <SelectItem value="OTHER_IN">Otro Ingreso</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {justifyReason === 'TRANSFER' && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-medium">Cuenta Manual</Label>
                                        <CashContainerSelector
                                            value={justifyTargetId}
                                            onChange={setJustifyTargetId}
                                            placeholder="Seleccione cuenta..."
                                        />
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Label className="text-[10px] font-medium">Notas</Label>
                                    <Textarea
                                        value={closeNotes}
                                        onChange={(e) => setCloseNotes(e.target.value)}
                                        placeholder="Detalles adicionales..."
                                        className={cn("resize-none text-xs", FORM_STYLES.input)}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Section: Treasury Withdrawal */}
            <div className="pt-4 border-t mt-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <Vault className="h-4 w-4" />
                    Retiro Físico de Efectivo (Vaciado de Caja)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className={FORM_STYLES.label}>Monto a Retirar ($)</Label>
                        <Input
                            type="number"
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                            className={cn("text-xl font-bold font-mono", FORM_STYLES.input)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className={FORM_STYLES.label}>Destino del Efectivo</Label>
                        <CashContainerSelector
                            value={cashDestinationId}
                            onChange={setCashDestinationId}
                            placeholder="Seleccione destino (ej. Bóveda)"
                        />
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}
