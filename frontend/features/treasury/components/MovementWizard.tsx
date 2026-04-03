import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Banknote, LogOut, ArrowRightLeft, Loader2, AlertTriangle, Info } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { Numpad } from "@/components/ui/numpad"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import api from "@/lib/api"
import { FORM_STYLES } from '@/lib/styles'

export interface MovementData {
    impact: 'IN' | 'OUT' | 'TRANSFER';
    moveType: string; // "TIP", "THEFT", "TRANSFER", etc.
    amount: number;
    notes: string;
    targetAccountId?: number; // Only for POS transfer (the other account)
    fromAccountId?: number; // For generic treasury
    toAccountId?: number; // For generic treasury
    isInflowForce?: boolean; // For POS to know transfer direction
    contactId?: number; // For partner/client movements
}

interface MovementWizardProps {
    context?: 'pos' | 'treasury';
    maxOutboundAmount?: number;
    fixedAccountId?: number; // For POS, the current session account
    fixedAccountName?: string; // For display
    initialContactId?: number; // For partner/client specific context
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
    const [step, setStep] = useState(1)
    const [impact, setImpact] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN')
    const [moveType, setMoveType] = useState('TIP')

    // Partner context
    const [contactId, setContactId] = useState<number | undefined>(initialContactId)
    const [contactName, setContactName] = useState<string | undefined>(initialContactName)

    // For Transfers
    const [transferDirection, setTransferDirection] = useState<'IN' | 'OUT'>('OUT') // IN = receive from, OUT = send to
    const [transferTargetId, setTransferTargetId] = useState<string>("") // POS transfer target
    const [fromAccountId, setFromAccountId] = useState<string>("") // Treasury from
    const [toAccountId, setToAccountId] = useState<string>("") // Treasury to
    const [fromAccountName, setFromAccountName] = useState("") // Display name
    const [toAccountName, setToAccountName] = useState("") // Display name

    const [amount, setAmount] = useState('0')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Partner capital warning state
    const [partnerCapitalInfo, setPartnerCapitalInfo] = useState<{ subscribed: number; balance: number; pending: number } | null>(null)

    // Fetch partner capital info when contactId changes and moveType is CAPITAL_CONTRIBUTION
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

    const handleComplete = async () => {
        setSubmitting(true)
        try {
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
                // Normal IN/OUT
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
        } catch (error) {
            console.error(error)
        } finally {
            setSubmitting(false)
        }
    }

    // If fixedMoveType is present, set it and potentially skip to the amount step (Step 4)
    useEffect(() => {
        if (fixedMoveType) {
            const foundIn = MOVEMENT_TYPES.IN.find(t => t.value === fixedMoveType);
            const foundOut = MOVEMENT_TYPES.OUT.find(t => t.value === fixedMoveType);

            if (foundIn) {
                setImpact('IN');
                setMoveType(fixedMoveType);
            } else if (foundOut) {
                setImpact('OUT');
                setMoveType(fixedMoveType);
            } else if (fixedMoveType === 'TRANSFER') {
                setImpact('TRANSFER');
                setMoveType('TRANSFER');
            }

            // If fixedMoveType is provided, we can skip directly to step 4 (Amount)
            // unless it's a treasury context and needs account selection first (step 2)
            if (context === 'treasury' && fixedMoveType !== 'TRANSFER') {
                // For treasury IN/OUT, we still need to select the account first (Step 2)
                setStep(2);
            } else {
                setStep(4);
            }
        }
    }, [fixedMoveType, context]);

    const renderStep = () => {
        return (
            <div className="min-h-[460px] flex flex-col justify-between">
                <div className="flex-1 flex flex-col justify-center">
                    {(() => {
                        switch (step) {
                            case 1: // Impact Selection
                                return (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="text-center mb-6">
                                            <h3 className="text-lg font-bold">Tipo de Movimiento</h3>
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
                                                    setStep(2)
                                                }}
                                            >
                                                <div className={cn("p-3 rounded-xl bg-success/10 text-success", impact === "IN" && "bg-success text-white")}>
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
                                                    setStep(2)
                                                }}
                                            >
                                                <div className={cn("p-3 rounded-xl bg-warning/10 text-warning", impact === "OUT" && "bg-warning text-white")}>
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
                                                        setStep(2)
                                                    }}
                                                >
                                                    <div className={cn("p-3 rounded-xl bg-info/10 text-info", impact === "TRANSFER" && "bg-info text-white")}>
                                                        <ArrowRightLeft className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">Traspaso</span>
                                                        <span className="text-xs text-muted-foreground">Mover a otra caja</span>
                                                    </div>
                                                </Button>
                                            )}
                                        </div>
                                        <Button variant="ghost" onClick={onCancel} className="w-full mt-4">Cancelar</Button>
                                    </div>
                                )

                            case 2: // Details Selection
                                if (context === 'pos') {
                                    if (impact === 'TRANSFER') {
                                        return (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="text-center mb-4">
                                                    <h3 className="font-bold">Detalles del Traspaso</h3>
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

                                                <div className="flex gap-2 pt-4">
                                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
                                                    <Button
                                                        onClick={() => setStep(4)}
                                                        className="flex-1"
                                                        disabled={!transferTargetId}
                                                    >
                                                        Continuar
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    } else {
                                        return (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="text-center mb-4">
                                                    <h3 className="font-bold">Motivo del {variant === 'partners' ? (impact === 'IN' ? 'Aporte' : 'Retiro') : (impact === "IN" ? "Depósito" : "Retiro")}</h3>
                                                </div>
                                                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                    {MOVEMENT_TYPES[impact as 'IN' | 'OUT'].map((t) => (
                                                        <Button
                                                            key={t.value}
                                                            variant={moveType === t.value ? "default" : "outline"}
                                                            className="justify-start h-auto py-3 px-4"
                                                            onClick={() => {
                                                                setMoveType(t.value)
                                                                setStep(4)
                                                            }}
                                                        >
                                                            {t.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 pt-4">
                                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
                                                    <Button
                                                        onClick={() => setStep(4)}
                                                        className="flex-1"
                                                        disabled={!moveType}
                                                    >
                                                        Siguiente
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    }
                                } else {
                                    // Treasury Context
                                    if (impact === 'TRANSFER') {
                                        return (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="text-center mb-4">
                                                    <h3 className="font-bold">Detalles del Traspaso</h3>
                                                    <p className="text-sm text-muted-foreground">Seleccione cuentas de origen y destino</p>
                                                </div>
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
                                                <div className="flex gap-2 pt-4">
                                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
                                                    <Button
                                                        onClick={() => setStep(4)}
                                                        className="flex-1"
                                                        disabled={!fromAccountId || !toAccountId}
                                                    >
                                                        Continuar
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    } else {
                                        const isReady = impact === 'IN' ? !!toAccountId : !!fromAccountId
                                        return (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="text-center mb-4">
                                                    <h3 className="font-bold">Seleccionar Cuenta</h3>
                                                    <p className="text-sm text-muted-foreground">¿En qué cuenta se registra el {impact === 'IN' ? 'ingreso' : 'gasto'}?</p>
                                                </div>
                                                <div className="space-y-2 p-4 bg-muted/20 border rounded-xl">
                                                    <Label className={FORM_STYLES.label}>
                                                        {impact === 'IN' ? 'Cuenta de Destino' : 'Cuenta de Origen'}
                                                    </Label>
                                                    <TreasuryAccountSelector
                                                        value={impact === 'IN' ? toAccountId : fromAccountId}
                                                        onChange={(val) => impact === 'IN' ? setToAccountId(val || "") : setFromAccountId(val || "")}
                                                        onSelect={(acc) => impact === 'IN' ? setToAccountName(acc.name) : setFromAccountName(acc.name)}
                                                    />
                                                </div>
                                                <div className="flex gap-2 pt-4">
                                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
                                                    <Button
                                                        onClick={() => {
                                                            if (variant === 'partners') {
                                                                setMoveType(impact === 'IN' ? 'CAPITAL_CONTRIBUTION' : 'PARTNER_WITHDRAWAL')
                                                                setStep(4)
                                                            } else {
                                                                setStep(fixedMoveType ? 4 : 3)
                                                            }
                                                        }}
                                                        className="flex-1"
                                                        disabled={!isReady}
                                                    >
                                                        { (fixedMoveType || variant === 'partners') ? 'Continuar' : 'Siguiente'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    }
                                }

                            case 3: // Reason Selection (Treasury IN/OUT only)
                                return (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="text-center mb-4">
                                            <h3 className="font-bold text-lg">Motivo del Movimiento</h3>
                                            <p className="text-sm text-muted-foreground">Indique la razón del {variant === 'partners' ? (impact === 'IN' ? 'aporte' : 'retiro') : (impact === "IN" ? "depósito" : "retiro")}</p>
                                        </div>
                                        <div className="grid gap-2 max-h-[340px] overflow-y-auto pr-1">
                                            {MOVEMENT_TYPES[impact as 'IN' | 'OUT'].map((t) => (
                                                <Button
                                                    key={t.value}
                                                    variant={moveType === t.value ? "default" : "outline"}
                                                    className="justify-start h-auto py-4 px-6 text-base"
                                                    onClick={() => {
                                                        setMoveType(t.value)
                                                        setStep(4)
                                                    }}
                                                >
                                                    {t.label}
                                                </Button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-4">
                                            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Atrás</Button>
                                            <Button
                                                onClick={() => setStep(4)}
                                                className="flex-1"
                                                disabled={!moveType}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                )

                            case 4: // Amount
                                const isPartnerReason = moveType === 'PARTNER_WITHDRAWAL' || moveType === 'CAPITAL_CONTRIBUTION';
                                return (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="text-center space-y-1">
                                            <h3 className="font-bold text-lg uppercase tracking-tight">Monto</h3>
                                            <Badge variant="outline" className={cn(
                                                "capitalize font-bold border-2",
                                                impact === "IN" ? "border-success/50 text-success bg-success/10" :
                                                    impact === "OUT" ? "border-warning/50 text-warning bg-warning/10" :
                                                        "border-info/50 text-info bg-info/10"
                                            )}>
                                                {impact === 'TRANSFER' ? 'Traspaso' : MOVEMENT_TYPES[impact as 'IN' | 'OUT'].find(t => t.value === moveType)?.label}
                                            </Badge>
                                        </div>

                                        <div className="bg-muted/30 p-3 rounded-xl border-2 border-primary/10">
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

                                        {(isPartnerReason) && (
                                            <div className="space-y-2 bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <Label className={FORM_STYLES.label}>Socio Responsable</Label>
                                                <AdvancedContactSelector
                                                    value={contactId ? contactId.toString() : null}
                                                    onChange={(val) => setContactId(val ? parseInt(val) : undefined)}
                                                    onSelectContact={(acc) => {
                                                        setContactName(acc.name)
                                                        setPartnerCapitalInfo(null) // reset while loading
                                                    }}
                                                    placeholder={contactName || "Seleccionar Socio..."}
                                                    isPartnerOnly={isPartnerReason}
                                                    disabled={!!initialContactId}
                                                />
                                            </div>
                                        )}

                                        {/* Option B: Warning when contribution exceeds pending subscribed capital */}
                                        {moveType === 'CAPITAL_CONTRIBUTION' && contactId && partnerCapitalInfo && (() => {
                                            const amountNum = parseFloat(amount) || 0
                                            if (amountNum <= 0) return null
                                            if (amountNum > partnerCapitalInfo.subscribed && partnerCapitalInfo.subscribed > 0) {
                                                // Exceeds total subscribed (very unusual)
                                                return (
                                                    <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs text-warning">
                                                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold block">Aporte supera el capital suscrito total</span>
                                                            <span>El socio tiene suscrito {formatCurrency(partnerCapitalInfo.subscribed)}. Este aporte excede ese monto. Considere registrar primero un Aumento de Capital.</span>
                                                        </div>
                                                    </div>
                                                )
                                            } else if (partnerCapitalInfo.pending <= 0) {
                                                // Already fully paid
                                                return (
                                                    <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-xl text-xs text-info">
                                                        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold block">Capital ya enterado</span>
                                                            <span>Este socio ya tiene su suscripción completamente pagada ({formatCurrency(partnerCapitalInfo.subscribed)}). Este aporte generará un excedente en su cuenta particular.</span>
                                                        </div>
                                                    </div>
                                                )
                                            } else if (amountNum > partnerCapitalInfo.pending) {
                                                // Exceeds remaining pending
                                                return (
                                                    <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs text-warning">
                                                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold block">Aporte supera el capital pendiente</span>
                                                            <span>El socio tiene {formatCurrency(partnerCapitalInfo.pending)} pendiente de entero. Este aporte genera un excedente de {formatCurrency(amountNum - partnerCapitalInfo.pending)} en su cuenta particular.</span>
                                                        </div>
                                                    </div>
                                                )
                                            } else {
                                                // Within range — show a positive info
                                                return (
                                                    <div className="flex items-center gap-2 p-2.5 bg-success/10 border border-success/20 rounded-xl text-xs text-success">
                                                        <Info className="h-3.5 w-3.5 text-success shrink-0" />
                                                        <span>Pendiente de entero: <strong>{formatCurrency(partnerCapitalInfo.pending)}</strong></span>
                                                    </div>
                                                )
                                            }
                                        })()}
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => setStep((impact === 'TRANSFER' || fixedMoveType) ? 2 : (context === 'pos' ? 2 : 3))} className="flex-1">Atrás</Button>
                                            <Button
                                                onClick={() => setStep(5)}
                                                className="flex-1"
                                                disabled={parseFloat(amount) <= 0 || ((moveType === 'PARTNER_WITHDRAWAL' || moveType === 'CAPITAL_CONTRIBUTION') && !contactId)}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                )

                            case 5: // Summary
                                const amountNum = parseFloat(amount) || 0
                                const isOutbound = impact === 'OUT' || (impact === 'TRANSFER' && transferDirection === 'OUT')
                                const hasInsufficientFunds = isOutbound && maxOutboundAmount !== undefined && amountNum > maxOutboundAmount

                                return (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="text-center">
                                            <h3 className="font-bold text-xl uppercase tracking-tighter">Confirmar Movimiento</h3>
                                            <p className="text-sm text-muted-foreground">Revise los detalles antes de registrar</p>
                                        </div>

                                        <div className="bg-card border-2 rounded-xl divide-y-2 overflow-hidden">
                                            <div className="p-4 flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-medium">Operación:</span>
                                                <Badge className={cn(
                                                    "font-black uppercase tracking-widest px-3",
                                                    impact === "IN" ? "bg-success" : impact === "OUT" ? "bg-warning" : "bg-info"
                                                )}>
                                                    {impact === 'IN' ? 'Ingreso' : impact === 'OUT' ? 'Salida' : 'Traspaso'}
                                                </Badge>
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
                                                    <span className="font-bold">{MOVEMENT_TYPES[impact as 'IN' | 'OUT'].find(t => t.value === moveType)?.label}</span>
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
                                            <div className="p-3 bg-destructive/10 border-2 border-destructive/20 text-destructive rounded-xl text-center text-sm font-bold">
                                                FONDOS INSUFICIENTES (Máx: {formatCurrency(maxOutboundAmount)})
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setStep(4)} className="flex-1 border-2">Corregir</Button>
                                            <Button
                                                onClick={handleComplete}
                                                className="flex-1 font-bold text-base h-12"
                                                disabled={submitting || hasInsufficientFunds}
                                            >
                                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                CONFIRMAR Y REGISTRAR
                                            </Button>
                                        </div>
                                    </div>
                                )

                            default: return null
                        }
                    })()}
                </div>
            </div>
        )
    }

    return (
        <div className="py-2">
            {renderStep()}
        </div>
    )
}
