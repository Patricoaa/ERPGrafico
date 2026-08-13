"use client"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Loader2, AlertTriangle, Search, ChevronDown, Check } from "lucide-react"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { GenericWizard, Numpad, type WizardStep } from '@/components/shared'
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"

import { LabeledContainer } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useTouchMode } from "@/hooks/useTouchMode"
import { POSReport, type POSReportData } from "./POSReport"

import type { POSSession, POSSessionAudit, AccountingSettings, TreasuryAccount } from "@/types/pos"
import { CLOSE_DEFICIT_OPTIONS, CLOSE_SURPLUS_OPTIONS } from "@/features/pos/utils/reasons"

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
    const { isTouchMode } = useTouchMode()

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

    // Step index for GenericWizard (0: count, 1: review, 2: decision, 3: withdraw)
    const [stepIndex, setStepIndex] = useState(0)

    const [accountingSettings, setAccountingSettings] = useState<AccountingSettings | null>(null)
    const [settingsLoading, setSettingsLoading] = useState(false)

    // Fetch Accounting Settings and Full Report Data
    const [fullReportData, setFullReportData] = useState<POSReportData | null>(null)
    const [reportDataLoading, setReportDataLoading] = useState(false)

    // Derived values for validation and display
    const actual = parseFloat(actualCash) || 0
    const expected = fullReportData
        ? Number(fullReportData.opening_balance || 0) + Number(fullReportData.total_cash_sales || 0) + Number(fullReportData.total_manual_inflow || 0) - Number(fullReportData.total_manual_outflow || 0)
        : session.expected_cash
    const diff = actual - expected
    const hasDiff = diff !== 0

    // Pre-populate expected cash and default treasury account when modal opens
    useEffect(() => {
        if (open && session) {
            requestAnimationFrame(() => {
                setActualCash(expected.toString())
                setCloseNotes("")
                setJustifyReason("")
                setJustifyTargetId(null)
                setSelectedAccount(null)
                setInsufficientFunds(false)
                setStepIndex(0) // Reset to step 1
                setCashDestinationId(null) // Force user to pick a valid destination
            })
        }
    }, [open, session, expected])

    useEffect(() => {
        if (open && session) {
            let cancelled = false
            requestAnimationFrame(() => {
                if (cancelled) return
                setReportDataLoading(true)
                setSettingsLoading(true)
                posApi.getAccountingSettings()
                    .then(data => { if (!cancelled) requestAnimationFrame(() => setAccountingSettings(data)) })
                    .catch(err => { if (!cancelled) console.error("Failed to load accounting settings", err) })
                    .finally(() => { if (!cancelled) requestAnimationFrame(() => setSettingsLoading(false)) })

                posApi.getSessionSummary(session.id)
                    .then(data => { if (!cancelled) requestAnimationFrame(() => setFullReportData(data)) })
                    .catch(err => { if (!cancelled) console.error("Failed to load sumary", err) })
                    .finally(() => { if (!cancelled) requestAnimationFrame(() => setReportDataLoading(false)) })
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

    const handleCloseSession = async (overrides?: { withdrawal_amount?: number }): Promise<boolean> => {
        if (!session) return false

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

            const closeResponse = closeData as { audit: POSSessionAudit }
            const audit = closeResponse.audit
            const difference = parseFloat(String(audit.difference))

            if (difference !== 0) {
                const diffType = difference > 0 ? "sobrante" : "faltante"
                toast.warning(`Sesión cerrada con ${diffType} de ${formatCurrency(Math.abs(difference))}`)
            } else {
                toast.success("Sesión cerrada correctamente - Cuadra perfecto!")
            }

            // Call success callback
            onSuccess?.(audit)

            // Reset form
            setActualCash("0")
            setCloseNotes("")
            setJustifyReason("")
            setJustifyTargetId(null)
            setCashDestinationId(null)

            return true
        } catch (error: unknown) {
            showApiError(error, "Error al cerrar sesión")
            return false
        } finally {
            setSubmitting(false)
        }
    }

    // GenericWizard completion: close the modal only on success (stays open on error)
    const handleComplete = async () => {
        const ok = await handleCloseSession()
        if (ok) {
            onOpenChange(false)
        }
    }

    // Step 1: Count
    const countStepContent = (() => {
        const hasReportData = fullReportData !== null
        const reportData = fullReportData || {
            session_id: session.id,
            opening_balance: session.opening_balance,
            total_cash_sales: session.total_cash_sales,
            total_card_sales: session.total_card_sales,
            total_transfer_sales: session.total_transfer_sales,
            total_credit_sales: session.total_credit_sales,
            total_check_sales: session.total_check_sales,
            total_sales: session.total_cash_sales + session.total_card_sales + session.total_transfer_sales + session.total_credit_sales + session.total_check_sales,
            expected_cash: session.expected_cash,
            total_manual_inflow: session.total_other_cash_inflow,
            total_manual_outflow: session.total_other_cash_outflow,
            manual_movements: session.cash_movements as unknown as POSReportData["manual_movements"],
            sales_by_category: session.sales_by_category as POSReportData["sales_by_category"],
            treasury_account_id: typeof session.treasury_account === 'object' ? session.treasury_account?.id : (session.treasury_account as number || undefined),
            user_name: session.user_name,
            terminal_name: session.terminal_name,
            opened_at: session.opened_at,
            closed_at: session.closed_at ?? undefined,
        } as POSReportData

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Left Column: Report context */}
                <POSReport
                    data={reportData}
                    type="Z"
                    loading={!hasReportData && reportDataLoading}
                />

                {/* Right Column: Counter */}
                <div className="space-y-4">
                    <div className="md:hidden mb-4 p-3 bg-primary/10 rounded-md border border-primary/10">
                        <div className="flex justify-between text-sm font-bold">
                            <span>Efectivo Esperado:</span>
                            <span className="text-primary">{formatCurrency(expected)}</span>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <div className="w-full bg-muted/30 p-4 rounded-md">
                            <Numpad
                                value={actualCash}
                                onChange={setActualCash}
                                title="Efectivo Contado"
                                displayValue={formatCurrency(parseFloat(actualCash) || 0)}
                                allowDecimal={true}
                                className="w-full max-w-full shadow-none border-0 p-0"
                                onConfirm={() => setStepIndex(1)}
                                confirmLabel="Confirmar Conteo"
                                onExactAmount={() => setActualCash(expected.toString())}
                                exactAmountLabel={`Monto Exacto (${formatCurrency(expected)})`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    })()

    // Step 2: Review & Difference
    const reviewStepContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-card border rounded-md p-4 space-y-3 shadow-card">
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
                                            /* eslint-disable-next-line no-restricted-syntax -- inline spinner in combobox trigger, not a submit/action button */
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
                                    excludeId={session.treasury_account !== null && typeof session.treasury_account === 'object' ? session.treasury_account.id : (session.treasury_account ?? undefined)}
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
                )
            })()}

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
        </div>
    )

    const reviewIsValid = !(hasDiff && !justifyReason) && !(justifyReason === 'TRANSFER' && !justifyTargetId) && !insufficientFunds

    // Step 3: Decision
    const decisionStepContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 gap-3">
                <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center border-2 hover:border-primary hover:bg-primary/5 group"
                    onClick={() => setStepIndex(3)}
                >
                    <span className="font-medium">Sí, realizar retiro/traspaso</span>
                    <span className="text-xs text-muted-foreground">Configurar monto y destino</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center border-2 border-success/40 hover:border-success hover:bg-success/5 group"
                    onClick={() => handleCloseSession({ withdrawal_amount: 0 })}
                    disabled={submitting}
                >
                    <span className="font-medium text-success">No, cerrar sin retirar</span>
                    <span className="text-xs text-muted-foreground">Finaliza la sesión ahora</span>
                </Button>
            </div>
        </div>
    )

    // Step 4: Withdrawal (Optional Step)
    const withdrawStepContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-4 bg-muted/20 rounded-md space-y-4">
                <div className="space-y-4">
                    <Numpad
                        value={withdrawalAmount}
                        onChange={setWithdrawalAmount}
                        title="Monto a Retirar"
                        displayValue={formatCurrency(parseFloat(withdrawalAmount) || 0)}
                        allowDecimal={true}
                        className="w-full max-w-full shadow-none border-0 p-0"
                        onConfirm={() => {
                            if (parseFloat(withdrawalAmount) > 0 && !cashDestinationId) {
                                toast.error("Seleccione un destino para el retiro antes de finalizar")
                                return
                            }
                            handleCloseSession().then(ok => { if (ok) onOpenChange(false) })
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
                        excludeId={session.treasury_account !== null && typeof session.treasury_account === 'object' ? session.treasury_account.id : (session.treasury_account ?? undefined)}
                    />
                </LabeledContainer>
            </div>
        </div>
    )

    const steps: WizardStep[] = [
        {
            id: 'count',
            title: 'Cierre de Sesión y Conteo',
            component: countStepContent,
            isValid: true
        },
        {
            id: 'review',
            title: 'Resumen de Cierre',
            component: reviewStepContent,
            isValid: reviewIsValid
        },
        {
            id: 'decision',
            title: 'Retiro o Traspaso',
            component: decisionStepContent,
            isValid: true
        },
        {
            id: 'withdraw',
            title: 'Configurar Retiro',
            component: withdrawStepContent,
            isValid: !(parseFloat(withdrawalAmount) > 0 && !cashDestinationId)
        }
    ]

    return (
        <GenericWizard
            open={open}
            onOpenChange={(val) => {
                if (!val) {
                    // Closing mid-wizard would discard the count — block dismissals while submitting
                    if (!submitting) onOpenChange(val)
                } else {
                    onOpenChange(val)
                }
            }}
            title="Cierre de Sesión"
            steps={steps}
            initialStep={stepIndex}
            onComplete={handleComplete}
            isCompleting={submitting}
            completeButtonLabel="Finalizar Cierre"
            size="lg"
            touchMode={isTouchMode}
            hideScrollArea={true}
            contentClassName="p-4 sm:p-6"
            onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
        />
    )
}
