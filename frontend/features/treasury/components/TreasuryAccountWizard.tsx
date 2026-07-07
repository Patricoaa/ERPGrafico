"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
    Wallet, Landmark, CreditCard, Banknote,
    ArrowDownToLine, ArrowUpFromLine, ArrowDownUp, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    GenericWizard, LabeledInput, LabeledSelect, MultiSelectTagInput, FormSection,
} from "@/components/shared"
import type { WizardStep } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useBanks } from "../hooks/useMasterData"
import { useProvisionAccount } from "../hooks/useTreasuryAccounts"
import type { TreasuryAccountType } from "../types"

interface TreasuryAccountWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    defaultBankId?: number
}

type Usage = "sales" | "purchases" | "both"

// Tipos de cuenta ofrecidos en el alta (Capa 1 — ubicación del dinero).
// DEBIT_CARD / CHECKBOOK ya no son tipos de cuenta: son formas de pago (Capa 2).
const ACCOUNT_TYPE_CARDS: { type: TreasuryAccountType; label: string; hint: string; icon: typeof Wallet }[] = [
    { type: "CASH", label: "Caja", hint: "Efectivo físico", icon: Wallet },
    { type: "CHECKING", label: "Cuenta Bancaria", hint: "Corriente / Vista", icon: Landmark },
    { type: "CREDIT_CARD", label: "Tarjeta de Crédito", hint: "Línea propia", icon: CreditCard },
    { type: "LOAN", label: "Préstamo Bancario", hint: "Deuda por pagar", icon: Banknote },
]

const TENDER_OPTIONS = [
    { label: "Transferencia", value: "TRANSFER" },
    { label: "Cheque", value: "CHECK" },
    { label: "Tarjeta de Débito", value: "DEBIT_CARD" },
]

const TENDER_LABELS: Record<string, string> = {
    TRANSFER: "Transferencia",
    CHECK: "Cheque",
    DEBIT_CARD: "Tarjeta de Débito",
    CASH: "Efectivo",
    CREDIT_CARD: "Tarjeta de Crédito",
}

const USAGE_CARDS: { value: Usage; label: string; hint: string; icon: typeof Wallet }[] = [
    { value: "sales", label: "Cobros", hint: "Solo ventas", icon: ArrowDownToLine },
    { value: "purchases", label: "Pagos", hint: "Solo compras", icon: ArrowUpFromLine },
    { value: "both", label: "Ambos", hint: "Cobros y pagos", icon: ArrowDownUp },
]

export function TreasuryAccountWizard({ open, onOpenChange, onSuccess, defaultBankId }: TreasuryAccountWizardProps) {
    const { banks } = useBanks()
    const { provision, isProvisioning } = useProvisionAccount()

    const [stepIndex, setStepIndex] = useState(0)
    const [accountType, setAccountType] = useState<TreasuryAccountType | "">("")
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [currency, setCurrency] = useState("CLP")
    const [accountId, setAccountId] = useState<string | null>(null)
    const [bank, setBank] = useState<string>("")
    const [accountNumber, setAccountNumber] = useState("")
    const [creditLimit, setCreditLimit] = useState("")
    const [tenders, setTenders] = useState<string[]>([])
    const [usage, setUsage] = useState<Usage>("both")

    // Reset al abrir (rAF para no llamar setState sincrónicamente en el effect).
    useEffect(() => {
        if (!open) return
        const id = requestAnimationFrame(() => {
            setStepIndex(0)
            setAccountType("")
            setName("")
            setCode("")
            setCurrency("CLP")
            setAccountId(null)
            setBank(defaultBankId ? String(defaultBankId) : "")
            setAccountNumber("")
            setCreditLimit("")
            setTenders([])
            setUsage("both")
        })
        return () => cancelAnimationFrame(id)
    }, [open, defaultBankId])

    const requiresBank = accountType === "CHECKING" || accountType === "CREDIT_CARD" || accountType === "LOAN"
    const isLiabilityType = accountType === "CREDIT_CARD" || accountType === "LOAN"
    const requiresAccountNumber = accountType === "CHECKING"
    const showTendersStep = accountType === "CHECKING"

    const selectType = (type: TreasuryAccountType) => {
        setAccountType(type)
        setTenders([])
        setBank("")
        setAccountNumber("")
        setStepIndex(1)
    }

    const fixedTenderLabel = accountType === "CASH" ? "Efectivo"
        : accountType === "CREDIT_CARD" ? "Tarjeta de Crédito" : null

    const steps: WizardStep[] = useMemo(() => {
        const list: (WizardStep | null)[] = [
            // 0 · Tipo de cuenta
            {
                id: "type",
                title: "Tipo de Cuenta",
                isValid: !!accountType,
                component: (
                    <div className="space-y-4 pt-2">
                        <p className="text-center text-sm text-muted-foreground mb-4">¿Dónde estará el dinero?</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {ACCOUNT_TYPE_CARDS.map(({ type, label, hint, icon: Icon }) => (
                                <Button
                                    key={type}
                                    variant="outline"
                                    className={cn(
                                        "h-32 flex flex-col items-center justify-center gap-3 border-2 transition-all",
                                        accountType === type ? "border-primary bg-primary/10" : "hover:border-primary/50"
                                    )}
                                    onClick={() => selectType(type)}
                                >
                                    <div className={cn(
                                        "p-3 rounded-md bg-primary/10 text-primary",
                                        accountType === type && "bg-primary text-primary-foreground"
                                    )}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold">{label}</span>
                                        <span className="text-xs text-muted-foreground">{hint}</span>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>
                ),
            },
            // 1 · Datos
            {
                id: "data",
                title: "Datos de la Cuenta",
                isValid: !!name.trim() && !!accountId
                    && (!requiresBank || !!bank)
                    && (!requiresAccountNumber || !!accountNumber.trim()),
                component: (
                    <div className="space-y-5 pt-2">
                        <FormSection title="Identificación" icon={Landmark} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LabeledInput
                                label="Nombre de la Cuenta"
                                placeholder="Ej: BCI Corriente"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <LabeledSelect
                                label="Moneda"
                                value={currency}
                                onChange={setCurrency}
                                options={[
                                    { value: "CLP", label: "Pesos (CLP)" },
                                    { value: "USD", label: "Dólar (USD)" },
                                ]}
                            />
                        </div>
                        <AccountSelector
                            label={accountType === "CREDIT_CARD"
                                ? "Cuenta de Pasivo — Tarjeta por pagar (2.x)"
                                : accountType === "LOAN"
                                    ? "Cuenta de Pasivo — Préstamo por pagar (2.x)"
                                    : "Cuenta Contable (Efectivo y Equivalentes — 1.1.01)"}
                            value={accountId}
                            onChange={setAccountId}
                            accountType={isLiabilityType ? "LIABILITY" : "ASSET"}
                        />
                        {requiresBank && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <LabeledSelect
                                    label="Entidad Bancaria"
                                    value={bank}
                                    onChange={setBank}
                                    options={(banks ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
                                />
                                <LabeledInput
                                    label={requiresAccountNumber ? "N° de Cuenta Bancaria" : "N° de Cuenta (opcional)"}
                                    placeholder="00123456"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                />
                            </div>
                        )}
                        <LabeledInput
                            label="Código / Alias (opcional)"
                            placeholder="Ej: BCI-01"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                        {accountType === "CREDIT_CARD" && (
                            <LabeledInput
                                label="Cupo Total"
                                placeholder="5000000"
                                type="number"
                                value={creditLimit}
                                onChange={(e) => setCreditLimit(e.target.value)}
                            />
                        )}
                    </div>
                ),
            },
            // 2 · Formas de pago (solo CHECKING)
            showTendersStep ? {
                id: "tenders",
                title: "Formas de Pago",
                isValid: tenders.length > 0,
                component: (
                    <div className="space-y-4 pt-2">
                        <p className="text-center text-sm text-muted-foreground mb-2">
                            ¿Cómo se mueve el dinero en esta cuenta? Se crearán automáticamente sus formas de pago.
                        </p>
                        <MultiSelectTagInput
                            label="Formas de pago de esta cuenta"
                            options={TENDER_OPTIONS}
                            value={tenders}
                            onChange={setTenders}
                        />
                    </div>
                ),
            } : null,
            // 3 · Uso
            {
                id: "usage",
                title: "Uso",
                isValid: !!usage,
                component: (
                    <div className="space-y-4 pt-2">
                        <p className="text-center text-sm text-muted-foreground mb-4">
                            ¿Para qué usarás estas formas de pago?
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {USAGE_CARDS.map(({ value, label, hint, icon: Icon }) => (
                                <Button
                                    key={value}
                                    variant="outline"
                                    className={cn(
                                        "h-28 flex flex-col items-center justify-center gap-2 border-2 transition-all",
                                        usage === value ? "border-primary bg-primary/10" : "hover:border-primary/50"
                                    )}
                                    onClick={() => setUsage(value)}
                                >
                                    <Icon className="h-5 w-5 text-primary" />
                                    <span className="font-bold">{label}</span>
                                    <span className="text-xs text-muted-foreground">{hint}</span>
                                </Button>
                            ))}
                        </div>
                        {(accountType === "CREDIT_CARD") && (
                            <p className="text-center text-xs text-muted-foreground italic">
                                Las tarjetas de crédito de empresa se usan solo para compras.
                            </p>
                        )}
                    </div>
                ),
            },
            // 4 · Confirmación
            {
                id: "summary",
                title: "Confirmación",
                isValid: !isProvisioning,
                component: (
                    <div className="space-y-5 pt-2">
                        <p className="text-center text-sm text-muted-foreground">Revise antes de crear la cuenta.</p>
                        <div className="bg-transparent border rounded-md divide-y overflow-hidden text-sm">
                            <SummaryRow label="Tipo" value={ACCOUNT_TYPE_CARDS.find((c) => c.type === accountType)?.label ?? "—"} />
                            <SummaryRow label="Nombre" value={name || "—"} />
                            {requiresBank && (
                                <SummaryRow label="Banco" value={banks?.find((b) => String(b.id) === bank)?.name ?? "—"} />
                            )}
                            <SummaryRow
                                label="Formas de pago"
                                value={fixedTenderLabel ?? (tenders.length ? tenders.map((t) => TENDER_LABELS[t] ?? t).join(", ") : "—")}
                            />
                            <SummaryRow label="Uso" value={USAGE_CARDS.find((u) => u.value === usage)?.label ?? "—"} />
                            {accountType === "CREDIT_CARD" && creditLimit && (
                                <SummaryRow label="Cupo Total" value={`$${Number(creditLimit).toLocaleString('es-CL')}`} />
                            )}
                        </div>
                    </div>
                ),
            },
        ]
        return list.filter((s): s is WizardStep => s !== null)
    }, [accountType, name, code, currency, accountId, bank, accountNumber, creditLimit, tenders, usage, isProvisioning, banks,
        requiresBank, requiresAccountNumber, showTendersStep, fixedTenderLabel, isLiabilityType])

    const handleComplete = async () => {
        try {
            await provision({
                name: name.trim(),
                code: code.trim() || null,
                currency,
                account: accountId ? parseInt(accountId) : null,
                account_type: accountType as TreasuryAccountType,
                bank: requiresBank && bank ? parseInt(bank) : null,
                account_number: accountNumber.trim() || null,
                credit_limit: creditLimit ? Number(creditLimit) : null,
                tenders: accountType === "CHECKING" ? tenders : [],
                usage,
            })
            onOpenChange(false)
            onSuccess?.()
        } catch {
            // Error toast handled by useProvisionAccount
        }
    }

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            title="Nueva Cuenta de Tesorería"
            steps={steps}
            initialStep={stepIndex}
            onComplete={handleComplete}
            onClose={() => onOpenChange(false)}
            isCompleting={isProvisioning}
            completeButtonLabel="Crear Cuenta"
            completeButtonIcon={<CheckCircle2 className="h-4 w-4" />}
            size="md"
        />
    )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-3 flex justify-between items-center">
            <span className="text-muted-foreground font-medium">{label}:</span>
            <span className="font-bold text-right max-w-[220px] truncate">{value}</span>
        </div>
    )
}

export default TreasuryAccountWizard
