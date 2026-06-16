"use client"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, AlertTriangle, Search, ChevronDown, Check } from "lucide-react"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { BaseModal, Numpad } from '@/components/shared'
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"

import { LabeledContainer } from "@/components/shared"
import { cn } from "@/lib/utils"
import { POSReport, type POSReportData } from "./POSReport"

import type { POSSession, POSSessionAudit, AccountingSettings, TreasuryAccount } from "@/types/pos"
import { CLOSE_DEFICIT_OPTIONS, CLOSE_SURPLUS_OPTIONS, type JustifyOption } from "@/features/pos/utils/reasons"

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
    const [cashDestinationId, setCashDestinationId] = useState<number | null>(null)
    const [justifyReason, setJustifyReason] = useState<string>("")
    const [justifyTargetId, setJustifyTargetId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Fund validation states
    const [selectedAccount, setSelectedAccount] = useState<TreasuryAccount | null>(null)
    const [insufficientFunds, setInsufficientFunds] = useState(false)
    const [justifySearchTerm, setJustifySearchTerm] = useState("")
    const [justifyOpen, setJustifyOpen] = useState(false)

    // Sync withdrawalAmount with actualCash by default
    useEffect(() => {
        requestAnimationFrame(() => setWithdrawalAmount(actualCash))
    }, [actualCash])

    const [step, setStep] = useState(1)

    const [accountingSettings, setAccountingSettings] = useState<AccountingSettings | null>(null)
    const [settingsLoading, setSettingsLoading] = useState(false)

    // Derived values for validation and display
    const actual = parseFloat(actualCash) || 0
    const expected = session.expected_cash
    const diff = actual - expected
    const hasDiff = diff !== 0

    // Pre-populate expected cash and default treasury account when modal opens
    useEffect(() => {
        if (open && session) {
            requestAnimationFrame(() => {
                setActualCash(session.expected_cash.toString())
                setCloseNotes("")
                setJustifyReason("")
                setJustifyTargetId(null)
                setSelectedAccount(null)
                setInsufficientFunds(false)
                setStep(1) // Reset to step 1
                setCashDestinationId(null) // Force user to pick a valid destination
            })
        }
    }, [open, session])

    // Fetch Accounting Settings and Full Report Data
    const [fullReportData, setFullReportData] = useState<POSReportData | null>(null)
    useEffect(() => {
        if (open && session) {
            let cancelled = false
            requestAnimationFrame(() => {
                if (cancelled) return
                setSettingsLoading(true)
                posApi.getAccountingSettings()
                    .then(data => { if (!cancelled) requestAnimationFrame(() => setAccountingSettings(data)) })
                    .catch(err => { if (!cancelled) console.error("Failed to load accounting settings", err) })
                    .finally(() => { if (!cancelled) requestAnimationFrame(() => setSettingsLoading(false)) })

                posApi.getSessionSummary(session.id)
                    .then(data => { if (!cancelled) requestAnimationFrame(() => setFullReportData(data)) })
                    .catch(err => { if (!cancelled) console.error("Failed to load sumary", err) })
            })
            return () => { cancelled = true }
        }
    }, [open, session])

    // Fetch selected account details when justifyTargetId changes
    useEffect(() => {
        let cancelled = false
        if (justifyTargetId && justifyReason === 'TRANSFER') {
            posApi.getTreasuryAccount(Number(justifyTargetId))
                .then((data: TreasuryAccount) => {
                    if (cancelled) return
                    requestAnimationFrame(() => {
                        if (cancelled) return
                        setSelectedAccount(data)
                        if (diff > 0 && data.current_balance !== undefined) {
                            const needed = Math.abs(diff)
                            setInsufficientFunds(data.current_balance < needed)
                        } else {
                            setInsufficientFunds(false)
                        }
                    })
                })
                .catch(err => {
                    if (cancelled) return
                    console.error("Failed to load account details", err)
                    requestAnimationFrame(() => {
                        if (cancelled) return
                        setSelectedAccount(null)
                        setInsufficientFunds(false)
                    })
                })
        } else {
            requestAnimationFrame(() => {
                if (cancelled) return
                setSelectedAccount(null)
                setInsufficientFunds(false)
            })
        }
        return () => { cancelled = true }
    }, [justifyTargetId, justifyReason, diff])

    const handleNext = () => setStep(p => p + 1)
    const handlePrev = () => setStep(p => p - 1)

    const handleCloseSession = async (overrides?: { withdrawal_amount?: number }) => {
        if (!session) return

        setSubmitting(true)
        try {
            const closeData = await posApi.closeSession(session.id, {
                actual_cash: parseFloat(actualCash) || 0,
                withdrawal_amount: overrides?.withdrawal_amount ?? (parseFloat(withdrawalAmount) || 0),
                notes: closeNotes,
                cash_destination_id: cashDestinationId,
                justify_reason: justifyReason || undefined,
                justify_target_id: justifyTargetId ? Number(justifyTargetId) : null
            })

            const audit = (closeData as any).audit
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
        } catch (error: unknown) {
            showApiError(error, "Error al cerrar caja")
        } finally {
            setSubmitting(false)
        }
    }

    const renderStepContent = () => {
        switch (step) {
            case 1: // Count
                const reportData = fullReportData || {
                    session_id: session.id,
                    opening_balance: session.opening_balance,
                    total_cash_sales: session.total_cash_sales,
                    total_card_sales: session.total_card_sales,
                    total_transfer_sales: session.total_transfer_sales,
                    total_credit_sales: session.total_credit_sales,
                    total_sales: session.total_cash_sales + session.total_card_sales + session.total_transfer_sales + session.total_credit_sales,
                    expected_cash: session.expected_cash,
                    total_manual_inflow: session.total_other_cash_inflow,
                    total_manual_outflow: session.total_other_cash_outflow,
                    manual_movements: session.cash_movements as unknown as POSReportData["manual_movements"],
                    sales_by_category: session.sales_by_category as POSReportData["sales_by_category"],
                    treasury_account_id: typeof session.treasury_account === 'object' ? session.treasury_account?.id : (session.treasury_account as number || undefined),
                }

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Left Column: Report context */}
                        <POSReport
                            data={reportData}
                            type="Z"
                        />

                        {/* Right Column: Counter */}
                        <div className="space-y-4">
                            <div className="md:hidden mb-4 p-3 bg-primary/10 rounded-md border border-primary/10">
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Efectivo Esperado:</span>
                                    <span className="text-primary">{formatCurrency(session.expected_cash)}</span>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="w-full bg-muted/30 p-4 rounded-md">
                                    <Numpad
                                        value={actualCash}
                                        onChange={setActualCash}
                                        label="Efectivo Contado"
                                        displayValue={formatCurrency(parseFloat(actualCash) || 0)}
                                        allowDecimal={true}
                                        className="w-full max-w-full shadow-none border-0 p-0"
                                        onConfirm={handleNext}
                                        confirmLabel="Confirmar Conteo"
                                        onExactAmount={() => setActualCash(session.expected_cash.toString())}
                                        exactAmountLabel={`Monto Exacto (${formatCurrency(session.expected_cash)})`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )

            case 2: // Review & Difference
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-card border rounded-md p-4 space-y-3 shadow-sm">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Efectivo Esperado (Sistema):</span>
                                <span className="font-medium">{formatCurrency(expected)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                                <span>Efectivo Contado (Real):</span>
                                <span className="text-primary">{formatCurrency(actual)}</span>
                            </div>
                        </div>

                        {(() => {
                            const closeReasons = diff < 0
                                ? (() => {
                                    let opts = [...CLOSE_DEFICIT_OPTIONS]
                                    if (!accountingSettings?.pos_partner_withdrawal_account) opts = opts.filter(o => o.value !== 'PARTNER_WITHDRAWAL')
                                    if (!accountingSettings?.pos_theft_account) opts = opts.filter(o => o.value !== 'THEFT')
                                    if (!accountingSettings?.pos_rounding_adjustment_account) opts = opts.filter(o => o.value !== 'ROUNDING')
                                    return opts
                                })()
                                : (() => {
                                    let opts = [...CLOSE_SURPLUS_OPTIONS]
                                    if (!accountingSettings?.pos_rounding_adjustment_account) opts = opts.filter(o => o.value !== 'ROUNDING')
                                    return opts
                                })()

                            const selectedLabel = closeReasons.find(r => r.value === justifyReason)?.label

                            return hasDiff ? (
                            <div className="bg-warning/10 border border-warning/20 rounded-md p-4 space-y-3">
                                <div className="flex items-center gap-2 text-warning font-bold">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Diferencia Detectada</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>{diff > 0 ? "Sobrante" : "Faltante"}:</span>
                                    <span className="font-bold text-lg">{formatCurrency(Math.abs(diff))}</span>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Motivo (Requerido)</Label>
                                    <Popover open={justifyOpen} onOpenChange={(open) => { setJustifyOpen(open); if (!open) setJustifySearchTerm("") }}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between h-9 bg-background font-normal"
                                                disabled={settingsLoading}
                                            >
                                                {settingsLoading ? (
                                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Cargando...</>
                                                ) : (
                                                    <>{selectedLabel || "Seleccione motivo..."}</>
                                                )}
                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <div className="p-2">
                                                {settingsLoading ? (
                                                    <div className="flex items-center justify-center py-6">
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                        <span className="ml-2 text-sm text-muted-foreground">Cargando opciones...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center px-3 border rounded-sm mb-2 bg-background">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                            <input
                                                                className="flex h-10 w-full rounded-sm bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                placeholder="Buscar motivo..."
                                                                value={justifySearchTerm}
                                                                onChange={(e) => setJustifySearchTerm(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                            {closeReasons
                                                                .filter(r => !justifySearchTerm || r.label.toLowerCase().includes(justifySearchTerm.toLowerCase()))
                                                                .map((opt) => (
                                                                    <div
                                                                        key={opt.value}
                                                                        className={cn(
                                                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                            justifyReason === opt.value && "bg-accent"
                                                                        )}
                                                                        onClick={() => {
                                                                            setJustifyReason(opt.value)
                                                                            setJustifySearchTerm("")
                                                                            setJustifyOpen(false)
                                                                        }}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        {justifyReason === opt.value && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                                                    </div>
                                                                ))}
                                                            {closeReasons.length > 0 && justifySearchTerm && !closeReasons.some(r => r.label.toLowerCase().includes(justifySearchTerm.toLowerCase())) && (
                                                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">Sin resultados</div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {justifyReason === 'TRANSFER' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-xs">
                                            {diff < 0 ? 'Cuenta de Destino (¿A dónde se llevó el dinero?)' : 'Cuenta de Origen (¿De dónde vino el dinero?)'}
                                        </Label>
                                        <TreasuryAccountSelector
                                            value={justifyTargetId}
                                            onChange={setJustifyTargetId}
                                            placeholder={diff < 0 ? "Seleccione destino..." : "Seleccione origen..."}
                                            excludeId={typeof session.treasury_account === 'object' ? session.treasury_account.id : session.treasury_account}
                                            type="CASH"
                                        />

                                        {insufficientFunds && selectedAccount && (
                                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                                    <div className="text-sm text-destructive">
                                                        <div className="font-bold">Fondos Insuficientes</div>
                                                        <div className="text-xs mt-1 space-y-0.5">
                                                            <div>Disponible en {selectedAccount.name}: {formatCurrency(selectedAccount.current_balance || 0)}</div>
                                                            <div>Necesario: {formatCurrency(Math.abs(diff))}</div>
                                                            <div className="font-semibold">Faltante: {formatCurrency(Math.abs(diff) - (selectedAccount.current_balance || 0))}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            ) : (
                                <div className="text-center p-6 bg-success/10 text-success rounded-md">
                                    <span className="text-4xl block mb-2">✨</span>
                                    <div className="font-bold">¡Cierre Perfecto!</div>
                                    <div className="text-sm opacity-80">El efectivo coincide exactamente con el sistema.</div>
                                </div>
                            )}
                        )()
                        }

                            <div className="space-y-1">
                                <Label className="text-xs">Notas (opcional)</Label>
<textarea
                                                                    className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:border-ring resize-none"
                                                                    rows={2}
                                    placeholder="Comentarios sobre el cierre..."
                                    value={closeNotes}
                                    onChange={(e) => setCloseNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev}>Modificar Conteo</Button>
                            <Button
                                className="flex-1"
                                onClick={handleNext}
                                disabled={
                                    (hasDiff && !justifyReason) ||
                                    (justifyReason === 'TRANSFER' && !justifyTargetId) ||
                                    insufficientFunds
                                }
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )

            case 3: // Decision Step
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                className="h-20 flex flex-col items-center justify-center border-2 hover:border-success hover:bg-success/5 group"
                                onClick={() => handleCloseSession({ withdrawal_amount: 0 })}
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
                        <div className="p-4 bg-muted/20 rounded-md space-y-4">
                            <div className="space-y-4">
                                <Numpad
                                    value={withdrawalAmount}
                                    onChange={setWithdrawalAmount}
                                    label="Monto a Retirar"
                                    displayValue={formatCurrency(parseFloat(withdrawalAmount) || 0)}
                                    allowDecimal={true}
                                    className="w-full max-w-full shadow-none border-0 p-0"
                                    onConfirm={() => {
                                        if (parseFloat(withdrawalAmount) > 0 && !cashDestinationId) {
                                            toast.error("Seleccione un destino para el retiro antes de finalizar")
                                            return
                                        }
                                        handleCloseSession()
                                    }}
                                    confirmLabel="Finalizar Cierre"
                                    onExactAmount={() => setWithdrawalAmount(actualCash)}
                                    exactAmountLabel={`Retirar Todo (${formatCurrency(actual)})`}
                                />
                            </div>

                            <LabeledContainer label="Destino">
                                <TreasuryAccountSelector
                                    value={cashDestinationId?.toString()}
                                    onChange={(val) => setCashDestinationId(val ? Number(val) : null)}
                                    placeholder="Seleccione destino..."
                                    paymentMethod="CASH"
                                    excludeId={typeof session.treasury_account === 'object' ? session.treasury_account.id : session.treasury_account}
                                />
                            </LabeledContainer>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrev} className="w-full">Atrás</Button>
                        </div>
                    </div>
                )
        }
    }

    // Step configuration for Header
    const getStepInfo = () => {
        switch (step) {
            case 1: return { title: "Cierre de Caja y Conteo", description: "Revise los totales del sistema y realice el conteo físico" }
            case 2: return { title: "Resumen de Cierre", description: "Verifique las diferencias y justifique si es necesario" }
            case 3: return { title: "Retiro o Traspaso", description: "¿Desea realizar un retiro de efectivo antes de cerrar?" }
            case 4: return { title: "Configurar Retiro", description: "Ingrese el monto y el destino para el retiro" }
            default: return { title: "Cierre de Caja", description: "" }
        }
    }

    const { title, description } = getStepInfo()

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            variant="wizard"
            title={title}
            description={description}
            className={cn(
                "transition-all duration-300",
                step === 1 ? "sm:max-w-4xl" : "sm:max-w-md"
            )}
            hideScrollArea={true}
            contentClassName="p-4 sm:p-6"
            onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
        >
            {renderStepContent()}
        </BaseModal>
    )
}
