"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Banknote, LogOut, ArrowRightLeft, Loader2, AlertTriangle, Info, ShieldAlert, CheckCircle2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { Numpad } from "@/components/ui/numpad"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import api from "@/lib/api"
import { FORM_STYLES } from '@/lib/styles'
import { validateAccountingPeriod } from '@/lib/actions/accounting-actions'
import { toast } from 'sonner'
import { GenericWizard, WizardStep } from '@/components/shared/GenericWizard'

export interface MovementData {
    impact: 'IN' | 'OUT' | 'TRANSFER';
    moveType: string;
    amount: number;
    notes: string;
    targetAccountId?: number;
    fromAccountId?: number;
    toAccountId?: number;
    isInflowForce?: boolean;
    contactId?: number;
}

interface MovementWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context?: 'pos' | 'treasury';
    maxOutboundAmount?: number;
    fixedAccountId?: number;
    fixedAccountName?: string;
    initialContactId?: number;
    initialContactName?: string;
    initialAccountName?: string;
    fixedMoveType?: string;
    variant?: 'partners' | 'standard';
    onComplete: (data: MovementData) => Promise<void>;
    onCancel: () => void;
}

const MOVEMENT_TYPES = {
    IN: [
        { value: "CAPITAL_CONTRIBUTION", label: "Aporte de Capital (Socio)" },
        { value: "TIP", label: "Propina" },
        { value: "OTHER_IN", label: "Otro Depósito (Varios)" },
        { value: "COUNTING_ERROR", label: "Error de Conteo (Sobrante)" },
        { value: "SYSTEM_ERROR", label: "Error de Sistema (Ajuste)" },
    ],
    OUT: [
        { value: "PARTNER_WITHDRAWAL", label: "Retiro de Socio" },
        { value: "THEFT", label: "Robo / Pérdida" },
        { value: "ROUNDING", label: "Redondeo" },
        { value: "CASHBACK", label: "Vuelto Incorrecto" },
        { value: "COUNTING_ERROR", label: "Error de Conteo (Faltante)" },
        { value: "SYSTEM_ERROR", label: "Error de Sistema (Ajuste)" },
        { value: "OTHER_OUT", label: "Otro Egreso (Gastos Varios)" },
    ]
}

export function MovementWizard({
    open,
    onOpenChange,
    context = 'pos',
    maxOutboundAmount,
    fixedAccountId,
    fixedAccountName,
    initialContactId,
    initialContactName,
    onComplete,
    onCancel,
    initialAccountName,
    fixedMoveType,
    variant = 'standard'
}: MovementWizardProps) {
    // Current Step index for GenericWizard
    const [stepIndex, setStepIndex] = useState(0)
    
    // Core state
    const [impact, setImpact] = useState<'IN' | 'OUT' | 'TRANSFER'>(() => {
        if (fixedMoveType === 'TRANSFER') return 'TRANSFER'
        if (fixedMoveType && MOVEMENT_TYPES.IN.find(t => t.value === fixedMoveType)) return 'IN'
        if (fixedMoveType && MOVEMENT_TYPES.OUT.find(t => t.value === fixedMoveType)) return 'OUT'
        return 'IN'
    })
    
    const [moveType, setMoveType] = useState(fixedMoveType || 'TIP')

    // Partner context
    const [contactId, setContactId] = useState<number | undefined>(initialContactId)
    const [contactName, setContactName] = useState<string | undefined>(initialContactName)

    // Direction/Accounts
    const [transferDirection, setTransferDirection] = useState<'IN' | 'OUT'>('OUT')
    const [transferTargetId, setTransferTargetId] = useState<string>("")
    const [fromAccountId, setFromAccountId] = useState<string>("")
    const [toAccountId, setToAccountId] = useState<string>("")
    const [fromAccountName, setFromAccountName] = useState("")
    const [toAccountName, setToAccountName] = useState("")

    const [amount, setAmount] = useState('0')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [partnerCapitalInfo, setPartnerCapitalInfo] = useState<{ subscribed: number; balance: number; pending: number } | null>(null)

    // Capital warning effect
    useEffect(() => {
        if (contactId && moveType === 'CAPITAL_CONTRIBUTION') {
            api.get(`/contacts/${contactId}/`).then(res => {
                const p = res.data
                const subscribed = parseFloat(p.partner_total_contributions) || 0
                const balance = parseFloat(p.partner_balance) || 0
                const pending = Math.max(0, subscribed - balance)
                setPartnerCapitalInfo({ subscribed, balance, pending })
            }).catch(() => setPartnerCapitalInfo(null))
        } else {
            setPartnerCapitalInfo(null)
        }
    }, [contactId, moveType])

    // Skip steps if fixedMoveType is provided
    useEffect(() => {
        if (fixedMoveType && open) {
            if (context === 'treasury' && fixedMoveType !== 'TRANSFER') {
                setStepIndex(1) // Go to Account selection
            } else {
                setStepIndex(3) // Go to Amount
            }
        }
    }, [fixedMoveType, context, open])

    const handleFinalComplete = async () => {
        setSubmitting(true)
        try {
            const today = new Date().toISOString().split('T')[0]
            const periodStatus = await validateAccountingPeriod(today)
            if (periodStatus.is_closed) {
                toast.error("No se puede registrar el movimiento: El periodo contable actual está cerrado.", {
                    icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
                    duration: 5000
                })
                return
            }

            const numAmount = parseFloat(amount) || 0
            const data: MovementData = {
                impact,
                moveType: impact === 'TRANSFER' ? 'TRANSFER' : moveType,
                amount: numAmount,
                notes,
                contactId,
            }

            if (impact === 'TRANSFER') {
                if (context === 'pos') {
                    data.targetAccountId = parseInt(transferTargetId)
                    data.isInflowForce = transferDirection === 'IN'
                } else {
                    if (fromAccountId) data.fromAccountId = parseInt(fromAccountId)
                    if (toAccountId) data.toAccountId = parseInt(toAccountId)
                }
            } else {
                if (context === 'pos') {
                    if (impact === 'IN') data.toAccountId = fixedAccountId
                    else data.fromAccountId = fixedAccountId
                } else {
                    if (impact === 'IN') {
                        if (toAccountId) data.toAccountId = parseInt(toAccountId)
                    } else {
                        if (fromAccountId) data.fromAccountId = parseInt(fromAccountId)
                    }
                }
            }

            await onComplete(data)
            onOpenChange(false)
        } catch (error) {
            console.error(error)
        } finally {
            setSubmitting(false)
        }
    }

    const steps: WizardStep[] = useMemo(() => {
        const list: WizardStep[] = [
            {
                id: 'impact',
                title: 'Tipo de Movimiento',
                component: (
                    <div className="space-y-4 pt-2">
                        <div className="text-center mb-6">
                            <p className="text-sm text-muted-foreground">Seleccione la operación a realizar</p>
                        </div>
                        <div className={cn(
                            "grid grid-cols-1 gap-4",
                            variant === 'partners' ? "md:grid-cols-2 max-w-xl mx-auto" : "md:grid-cols-3"
                        )}>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all",
                                    impact === "IN" ? "border-success bg-success/10" : "hover:border-success/50"
                                )}
                                onClick={() => {
                                    setImpact("IN")
                                    setMoveType(MOVEMENT_TYPES.IN[0].value)
                                    setStepIndex(1)
                                }}
                            >
                                <div className={cn("p-3 rounded-lg bg-success/10 text-success", impact === "IN" && "bg-success text-white")}>
                                    <Banknote className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold">{variant === 'partners' ? 'Aporte de Socio' : 'Depósito'}</span>
                                    <span className="text-xs text-muted-foreground">{variant === 'partners' ? 'Ingreso de capital' : 'Carga de efectivo'}</span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className={cn(
                                    "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all",
                                    impact === "OUT" ? "border-warning bg-warning/10" : "hover:border-warning/50"
                                )}
                                onClick={() => {
                                    setImpact("OUT")
                                    setMoveType(MOVEMENT_TYPES.OUT[0].value)
                                    setStepIndex(1)
                                }}
                            >
                                <div className={cn("p-3 rounded-lg bg-warning/10 text-warning", impact === "OUT" && "bg-warning text-white")}>
                                    <LogOut className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold">{variant === 'partners' ? 'Retiro de Socio' : 'Retiro'}</span>
                                    <span className="text-xs text-muted-foreground">{variant === 'partners' ? 'Salida de capital' : 'Salida de efectivo'}</span>
                                </div>
                            </Button>

                            {variant !== 'partners' && (
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all",
                                        impact === "TRANSFER" ? "border-info bg-info/10" : "hover:border-info/50"
                                    )}
                                    onClick={() => {
                                        setImpact("TRANSFER")
                                        setMoveType("TRANSFER")
                                        setStepIndex(1)
                                    }}
                                >
                                    <div className={cn("p-3 rounded-lg bg-info/10 text-info", impact === "TRANSFER" && "bg-info text-white")}>
                                        <ArrowRightLeft className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold">Traspaso</span>
                                        <span className="text-xs text-muted-foreground">Mover a otra caja</span>
                                    </div>
                                </Button>
                            )}
                        </div>
                    </div>
                )
            },
            {
                id: 'details',
                title: impact === 'TRANSFER' ? 'Detalles del Traspaso' : 'Seleccionar Cuenta',
                component: (
                    <div className="space-y-4 pt-2">
                        {context === 'pos' ? (
                            impact === 'TRANSFER' ? (
                                <>
                                    <div className="text-center mb-4">
                                        <p className="text-sm text-muted-foreground">{fixedAccountName}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <Button
                                            variant="outline"
                                            className={cn("h-20 flex-col", transferDirection === 'OUT' && "border-info bg-info/10")}
                                            onClick={() => setTransferDirection('OUT')}
                                        >
                                            <LogOut className="h-4 w-4 mb-1 text-info" />
                                            <span className="text-xs font-bold">Enviar/Retirar</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className={cn("h-20 flex-col", transferDirection === 'IN' && "border-info bg-info/10")}
                                            onClick={() => setTransferDirection('IN')}
                                        >
                                            <Banknote className="h-4 w-4 mb-1 text-info" />
                                            <span className="text-xs font-bold">Recibir/Ingresar</span>
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={FORM_STYLES.label}>
                                            {transferDirection === 'OUT' ? 'Hacia dónde va' : 'De dónde viene'}
                                        </Label>
                                        <TreasuryAccountSelector
                                            value={transferTargetId}
                                            onChange={(val) => setTransferTargetId(val || "")}
                                            excludeId={fixedAccountId}
                                            onSelect={(acc) => {
                                                if (transferDirection === 'IN') setFromAccountName(acc.name)
                                                else setToAccountName(acc.name)
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                                    {MOVEMENT_TYPES[impact as 'IN' | 'OUT'].map((t) => (
                                        <Button
                                            key={t.value}
                                            variant={moveType === t.value ? "default" : "outline"}
                                            className="justify-start h-auto py-3 px-4"
                                            onClick={() => {
                                                setMoveType(t.value)
                                                setStepIndex(3)
                                            }}
                                        >
                                            {t.label}
                                        </Button>
                                    ))}
                                </div>
                            )
                        ) : (
                            impact === 'TRANSFER' ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className={FORM_STYLES.label}>Origen (Retira)</Label>
                                        <TreasuryAccountSelector
                                            value={fromAccountId}
                                            onChange={(val) => setFromAccountId(val || "")}
                                            onSelect={(acc) => setFromAccountName(acc.name)}
                                        />
                                    </div>
                                    <div className="flex justify-center -my-2 relative z-10">
                                        <div className="bg-background border rounded-full p-1.5 shadow-sm text-muted-foreground">
                                            <ArrowRightLeft className="w-4 h-4 rotate-90" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className={FORM_STYLES.label}>Destino (Deposita)</Label>
                                        <TreasuryAccountSelector
                                            value={toAccountId}
                                            onChange={(val) => setToAccountId(val || "")}
                                            onSelect={(acc) => setToAccountName(acc.name)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2 p-4 bg-muted/20 border rounded-lg">
                                    <Label className={FORM_STYLES.label}>
                                        {impact === 'IN' ? 'Cuenta de Destino' : 'Cuenta de Origen'}
                                    </Label>
                                    <TreasuryAccountSelector
                                        value={impact === 'IN' ? toAccountId : fromAccountId}
                                        onChange={(val) => impact === 'IN' ? setToAccountId(val || "") : setFromAccountId(val || "")}
                                        onSelect={(acc) => impact === 'IN' ? setToAccountName(acc.name) : setFromAccountName(acc.name)}
                                    />
                                </div>
                            )
                        )}
                    </div>
                ),
                isValid: impact === 'TRANSFER' 
                    ? (context === 'pos' ? !!transferTargetId : (!!fromAccountId && !!toAccountId))
                    : (context === 'pos' ? !!moveType : (impact === 'IN' ? !!toAccountId : !!fromAccountId)),
                onNext: async () => {
                    if (context === 'treasury' && impact !== 'TRANSFER' && variant !== 'partners' && !fixedMoveType) {
                        return // Proceed to step 2 (Reason)
                    }
                    if (context === 'pos' && impact !== 'TRANSFER') {
                        return // Already handled by button click but safe
                    }
                    setStepIndex(3) // Jump to Amount
                    return false // Prevent automatic next
                }
            },
            {
                id: 'reason',
                title: 'Motivo del Movimiento',
                component: (
                    <div className="space-y-4 pt-2">
                        <div className="grid gap-2 max-h-[340px] overflow-y-auto pr-1">
                            {MOVEMENT_TYPES[impact as 'IN' | 'OUT'].map((t) => (
                                <Button
                                    key={t.value}
                                    variant={moveType === t.value ? "default" : "outline"}
                                    className="justify-start h-auto py-4 px-6 text-base"
                                    onClick={() => {
                                        setMoveType(t.value)
                                        setStepIndex(3)
                                    }}
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                ),
                isValid: !!moveType
            },
            {
                id: 'amount',
                title: 'Monto y Referencia',
                component: (
                    <div className="space-y-4 pt-2">
                            <div className={cn(
                                "capitalize font-bold border rounded px-2 py-0.5 text-xs",
                                impact === "IN" ? "border-success/30 text-success bg-success/5" :
                                    impact === "OUT" ? "border-warning/30 text-warning bg-warning/5" :
                                        "border-info/30 text-info bg-info/5"
                            )}>
                                {impact === 'TRANSFER' ? 'Traspaso' : MOVEMENT_TYPES[impact as 'IN' | 'OUT'].find(t => t.value === moveType)?.label}
                            </div>

                        <div className="bg-muted/30 p-3 rounded-lg border-2 border-primary/10">
                            <div className="text-right mb-2">
                                <div className="text-4xl font-black text-primary font-mono tracking-tighter">
                                    {formatCurrency(parseFloat(amount) || 0)}
                                </div>
                            </div>
                            <Numpad
                                value={amount}
                                onChange={setAmount}
                                hideDisplay={true}
                                allowDecimal={true}
                                className="w-full max-w-full shadow-none border-0 p-0"
                            />
                        </div>

                        {(moveType === 'PARTNER_WITHDRAWAL' || moveType === 'CAPITAL_CONTRIBUTION') && (
                            <div className="space-y-2 bg-primary/5 p-4 rounded-lg border border-primary/20">
                                <Label className={FORM_STYLES.label}>Socio Responsable</Label>
                                <AdvancedContactSelector
                                    value={contactId ? contactId.toString() : null}
                                    onChange={(val) => setContactId(val ? parseInt(val) : undefined)}
                                    onSelectContact={(acc) => {
                                        setContactName(acc.name)
                                        setPartnerCapitalInfo(null)
                                    }}
                                    placeholder={contactName || "Seleccionar Socio..."}
                                    isPartnerOnly={true}
                                    disabled={!!initialContactId}
                                />
                                {moveType === 'CAPITAL_CONTRIBUTION' && contactId && partnerCapitalInfo && (() => {
                                    const amountNum = parseFloat(amount) || 0
                                    if (amountNum <= 0) return null
                                    if (amountNum > partnerCapitalInfo.subscribed && partnerCapitalInfo.subscribed > 0) {
                                        return (
                                            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
                                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-bold block">Aporte supera el capital suscrito</span>
                                                    <span>Excede los {formatCurrency(partnerCapitalInfo.subscribed)} suscritos.</span>
                                                </div>
                                            </div>
                                        )
                                    } else if (partnerCapitalInfo.pending <= 0) {
                                        return (
                                            <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg text-xs text-info">
                                                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>Capital ya enterado ({formatCurrency(partnerCapitalInfo.subscribed)}). Generará excedente.</span>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="flex items-center gap-2 p-2.5 bg-success/10 border border-success/20 rounded-lg text-xs text-success">
                                            <Info className="h-3.5 w-3.5" />
                                            <span>Pendiente de entero: <strong>{formatCurrency(partnerCapitalInfo.pending)}</strong></span>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                        <div className="space-y-2">
                             <Label className={FORM_STYLES.label}>Observaciones (Opcional)</Label>
                             <Textarea 
                                placeholder="Notas adicionales del movimiento..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[60px] resize-none"
                             />
                        </div>
                    </div>
                ),
                isValid: parseFloat(amount) > 0 && ((moveType !== 'PARTNER_WITHDRAWAL' && moveType !== 'CAPITAL_CONTRIBUTION') || !!contactId)
            },
            {
                id: 'summary',
                title: 'Confirmación Final',
                component: (() => {
                    const amountNum = parseFloat(amount) || 0
                    const isOutbound = impact === 'OUT' || (impact === 'TRANSFER' && transferDirection === 'OUT')
                    const hasInsufficientFunds = isOutbound && maxOutboundAmount !== undefined && amountNum > maxOutboundAmount
                    
                    return (
                        <div className="space-y-6 pt-2">
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground">Revise los detalles antes de registrar</p>
                            </div>

                            <div className="bg-card border-2 rounded-lg divide-y-2 overflow-hidden">
                                <div className="p-4 flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Operación:</span>
                                    <span className={cn(
                                        "font-black uppercase tracking-widest px-3 py-1 rounded text-[10px]",
                                        impact === "IN" ? "bg-success/10 text-success border border-success/30" : 
                                        impact === "OUT" ? "bg-warning/10 text-warning border border-warning/30" : 
                                        "bg-info/10 text-info border border-info/30"
                                    )}>
                                        {impact === 'IN' ? 'Ingreso' : impact === 'OUT' ? 'Salida' : 'Traspaso'}
                                    </span>
                                </div>
                                {contactName && (
                                    <div className="p-4 flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">Socio:</span>
                                        <span className="font-bold">{contactName}</span>
                                    </div>
                                )}
                                {impact !== 'TRANSFER' && (
                                    <div className="p-4 flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">Motivo:</span>
                                        <span className="font-bold">{MOVEMENT_TYPES[impact as 'IN' | 'OUT']?.find(t => t.value === moveType)?.label}</span>
                                    </div>
                                )}
                                {(impact === 'OUT' || impact === 'TRANSFER') && (
                                    <div className="p-4 flex justify-between items-start text-sm">
                                        <span className="text-muted-foreground font-medium">Origen:</span>
                                        <span className="font-bold text-right max-w-[180px]">
                                            {context === 'pos'
                                                ? (impact === 'TRANSFER' && transferDirection === 'IN' ? fromAccountName : fixedAccountName)
                                                : fromAccountName
                                            }
                                        </span>
                                    </div>
                                )}
                                {(impact === 'IN' || impact === 'TRANSFER') && (
                                    <div className="p-4 flex justify-between items-start text-sm">
                                        <span className="text-muted-foreground font-medium">Destino:</span>
                                        <span className="font-bold text-right max-w-[180px]">
                                            {context === 'pos'
                                                ? (impact === 'TRANSFER' && transferDirection === 'OUT' ? toAccountName : fixedAccountName)
                                                : toAccountName
                                            }
                                        </span>
                                    </div>
                                )}
                                <div className="p-4 flex justify-between items-center py-4 bg-muted/20">
                                    <span className="text-muted-foreground font-bold">MONTO TOTAL:</span>
                                    <span className="text-2xl font-black text-primary">{formatCurrency(amountNum)}</span>
                                </div>
                            </div>

                            {hasInsufficientFunds && (
                                <div className="p-3 bg-destructive/10 border-2 border-destructive/20 text-destructive rounded-lg text-center text-sm font-bold">
                                    FONDOS INSUFICIENTES (Máx: {formatCurrency(maxOutboundAmount)})
                                </div>
                            )}
                        </div>
                    )
                })(),
                isValid: !submitting && !( (impact === 'OUT' || (impact === 'TRANSFER' && transferDirection === 'OUT')) && maxOutboundAmount !== undefined && parseFloat(amount) > maxOutboundAmount)
            }
        ]
        return list
    }, [impact, moveType, contactId, contactName, transferDirection, transferTargetId, fromAccountId, toAccountId, fromAccountName, toAccountName, amount, notes, submitting, partnerCapitalInfo, variant, context, fixedAccountId, fixedAccountName, maxOutboundAmount])

    return (
        <GenericWizard
            open={open}
            onOpenChange={(val) => {
                if (!val) onCancel()
                onOpenChange(val)
            }}
            title={variant === 'partners' ? 'Movimiento de Socio' : 'Movimiento de Tesorería'}
            steps={steps}
            initialStep={stepIndex}
            onComplete={handleFinalComplete}
            onClose={() => onOpenChange(false)}
            isCompleting={submitting}
            completeButtonLabel="Confirmar y Registrar"
            completeButtonIcon={<CheckCircle2 className="h-4 w-4" />}
            size="md"
        />
    )
}
