"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
    Landmark, CreditCard, Banknote, Plus, Trash2, Info,
} from "lucide-react"
import { GenericWizard, LabeledInput, LabeledSelect, FormSection, MultiSelectTagInput } from "@/components/shared"
import type { WizardStep } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useBanks } from "../hooks/useMasterData"
import { useProvisionAccount, useTreasuryAccounts } from "../hooks/useTreasuryAccounts"
import { useLoanMutations } from "../loans"

// ─── Local types ─────────────────────────────────────────────────────────────

interface NewCheckingAccount {
    name: string
    accountNumber: string
    tenders: string[]    // CHECK, TRANSFER, DEBIT_CARD
    currency: string
}

interface NewCreditCard {
    name: string
    currency: string
}

interface NewLoan {
    loan_number: string
    currency: "CLP" | "UF"
    principal: string
    interest_rate: string
    rate_basis: "MONTHLY" | "ANNUAL"
    amortization_system: "FRENCH" | "LINEAR"
    term_months: string
    start_date: string
    first_due_date: string
    disbursement_account: string
    liability_account: string
    notes: string
}

function emptyAccount(): NewCheckingAccount {
    return { name: "", accountNumber: "", tenders: [], currency: "CLP" }
}

function emptyCard(): NewCreditCard {
    return { name: "", currency: "CLP" }
}

function emptyLoan(): NewLoan {
    return {
        loan_number: "", currency: "CLP",
        principal: "", interest_rate: "", rate_basis: "MONTHLY",
        amortization_system: "FRENCH", term_months: "12",
        start_date: "", first_due_date: "",
        disbursement_account: "", liability_account: "", notes: "",
    }
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function SkipHint({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/40">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground/70">{text}</p>
        </div>
    )
}

function ItemCard({
    index,
    onRemove,
    children,
}: {
    index: number
    onRemove: () => void
    children: React.ReactNode
}) {
    return (
        <div className="rounded-lg border border-border/50 bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/40">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Ítem {index + 1}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                    onClick={onRemove}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="p-3 space-y-3">{children}</div>
        </div>
    )
}

const TENDER_OPTIONS = [
    { label: "Transferencias", value: "TRANSFER" },
    { label: "Chequera (cheques emitidos)", value: "CHECK" },
    { label: "Tarjeta de Débito", value: "DEBIT_CARD" },
]

const CURRENCY_OPTIONS = [
    { value: "CLP", label: "Pesos (CLP)" },
    { value: "UF", label: "UF" },
    { value: "USD", label: "Dólar (USD)" },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface BankCreationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BankCreationWizard({ open, onOpenChange, onSuccess }: BankCreationWizardProps) {
    const { createBank, isCreating: isBankCreating } = useBanks()
    const { mutateAsync: provision, isPending: isProvisioning } = useProvisionAccount()
    const { create: createLoan, isCreating: isLoanCreating } = useLoanMutations()
    const { accounts: existingAccounts } = useTreasuryAccounts()

    const isCreating = isBankCreating || isProvisioning || isLoanCreating

    // Bank
    const [bankName, setBankName] = useState("")
    const [bankCode, setBankCode] = useState("")
    const [bankSwift, setBankSwift] = useState("")
    const [createdBankId, setCreatedBankId] = useState<number | null>(null)

    // Checking accounts
    const [checkingAccounts, setCheckingAccounts] = useState<NewCheckingAccount[]>([])

    // Credit cards
    const [creditCards, setCreditCards] = useState<NewCreditCard[]>([])

    // Loans
    const [loans, setLoans] = useState<NewLoan[]>([])

    // Existing treasury accounts for loan selectors
    const disbursementOptions = useMemo(
        () =>
            (existingAccounts ?? [])
                .filter((a) => a.account_type === "CHECKING" || a.account_type === "CASH")
                .map((a) => ({ value: String(a.id), label: a.name })),
        [existingAccounts],
    )

    const liabilityOptions = useMemo(
        () =>
            (existingAccounts ?? [])
                .filter((a) => a.account_type === "CREDIT_CARD")
                .map((a) => ({ value: String(a.id), label: a.name })),
        [existingAccounts],
    )

    useEffect(() => {
        if (!open) return
        const id = requestAnimationFrame(() => {
            setBankName("")
            setBankCode("")
            setBankSwift("")
            setCreatedBankId(null)
            setCheckingAccounts([])
            setCreditCards([])
            setLoans([])
        })
        return () => cancelAnimationFrame(id)
    }, [open])

    // ── Mutators ──────────────────────────────────────────────────────────────

    const updateAccount = (i: number, patch: Partial<NewCheckingAccount>) =>
        setCheckingAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))

    const updateCard = (i: number, patch: Partial<NewCreditCard>) =>
        setCreditCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

    const updateLoan = (i: number, patch: Partial<NewLoan>) =>
        setLoans((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

    // ── Step handlers ─────────────────────────────────────────────────────────

    const handleCreateBank = async (): Promise<boolean> => {
        try {
            const result = await createBank({
                name: bankName.trim(),
                code: bankCode.trim() || undefined,
                swift_code: bankSwift.trim() || undefined,
            })
            setCreatedBankId(result.id)
            return true
        } catch {
            return false
        }
    }

    const handleComplete = async () => {
        if (!createdBankId) return
        try {
            for (const acc of checkingAccounts) {
                if (!acc.name.trim()) continue
                await provision({
                    name: acc.name.trim(),
                    account_type: "CHECKING",
                    bank: createdBankId,
                    account_number: acc.accountNumber.trim() || null,
                    currency: acc.currency,
                    account: null,
                    tenders: acc.tenders,
                    usage: "both",
                })
            }
            for (const card of creditCards) {
                if (!card.name.trim()) continue
                await provision({
                    name: card.name.trim(),
                    account_type: "CREDIT_CARD",
                    bank: createdBankId,
                    currency: card.currency,
                    account: null,
                    tenders: [],
                    usage: "purchases",
                })
            }
            for (const loan of loans) {
                if (!loan.principal || !loan.start_date || !loan.disbursement_account) continue
                await createLoan({
                    lender: createdBankId,
                    loan_number: loan.loan_number || undefined,
                    currency: loan.currency,
                    principal: loan.principal,
                    interest_rate: loan.interest_rate,
                    rate_basis: loan.rate_basis,
                    amortization_system: loan.amortization_system,
                    term_months: parseInt(loan.term_months) || 12,
                    start_date: loan.start_date,
                    first_due_date: loan.first_due_date,
                    disbursement_account: parseInt(loan.disbursement_account),
                    liability_account: parseInt(loan.liability_account),
                    notes: loan.notes || undefined,
                })
            }
            onSuccess?.()
            onOpenChange(false)
        } catch {
            // Error handled by hooks
        }
    }

    // ── Steps ─────────────────────────────────────────────────────────────────

    const loansValid = loans.every(
        (l) =>
            l.principal.trim() &&
            l.interest_rate.trim() &&
            l.term_months.trim() &&
            l.start_date &&
            l.first_due_date &&
            l.disbursement_account &&
            l.liability_account,
    )

    const steps: WizardStep[] = useMemo(
        () => [
            // ── 1. Datos del banco ────────────────────────────────────────────
            {
                id: "bank-data",
                title: "Datos del Banco",
                isValid: !!bankName.trim(),
                onNext: handleCreateBank,
                component: (
                    <div className="space-y-5 pt-2">
                        <FormSection title="Identificación" icon={Landmark} />
                        <LabeledInput
                            label="Nombre del Banco *"
                            placeholder="Ej: Banco de Chile"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <LabeledInput
                                label="Código (opcional)"
                                placeholder="Ej: 001"
                                value={bankCode}
                                onChange={(e) => setBankCode(e.target.value)}
                            />
                            <LabeledInput
                                label="SWIFT (opcional)"
                                placeholder="Ej: BCHICLRM"
                                value={bankSwift}
                                onChange={(e) => setBankSwift(e.target.value)}
                                maxLength={11}
                            />
                        </div>
                    </div>
                ),
            },

            // ── 2. Cuentas corrientes ─────────────────────────────────────────
            {
                id: "accounts",
                title: "Cuentas Corrientes",
                isValid: checkingAccounts.every((a) => a.name.trim() && a.accountNumber.trim()),
                component: (
                    <div className="space-y-4 pt-2">
                        <FormSection title="Cuentas Corrientes" icon={Landmark} />
                        <SkipHint text="Opcional. Agregue las cuentas bancarias de este banco. Por cada cuenta puede habilitar chequera y tarjeta de débito." />
                        <div className="space-y-3">
                            {checkingAccounts.map((acc, i) => (
                                <ItemCard key={i} index={i} onRemove={() => setCheckingAccounts((p) => p.filter((_, idx) => idx !== i))}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledInput
                                            label="Nombre de la cuenta *"
                                            placeholder="Ej: BCI Corriente"
                                            value={acc.name}
                                            onChange={(e) => updateAccount(i, { name: e.target.value })}
                                        />
                                        <LabeledInput
                                            label="N° de cuenta *"
                                            placeholder="00123456"
                                            value={acc.accountNumber}
                                            onChange={(e) => updateAccount(i, { accountNumber: e.target.value })}
                                        />
                                    </div>
                                    <LabeledSelect
                                        label="Moneda *"
                                        value={acc.currency}
                                        onChange={(v) => updateAccount(i, { currency: v })}
                                        options={CURRENCY_OPTIONS}
                                    />
                                    <MultiSelectTagInput
                                        label="Habilitar formas de pago"
                                        options={TENDER_OPTIONS}
                                        value={acc.tenders}
                                        onChange={(v) => updateAccount(i, { tenders: v })}
                                        placeholder="Seleccionar..."
                                    />
                                </ItemCard>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-dashed"
                            onClick={() => setCheckingAccounts((p) => [...p, emptyAccount()])}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar cuenta corriente
                        </Button>
                    </div>
                ),
            },

            // ── 3. Tarjetas de crédito ────────────────────────────────────────
            {
                id: "cards",
                title: "Tarjetas de Crédito",
                isValid: creditCards.every((c) => c.name.trim()),
                component: (
                    <div className="space-y-4 pt-2">
                        <FormSection title="Tarjetas de Crédito Empresa" icon={CreditCard} />
                        <SkipHint text="Opcional. Agregue tarjetas de crédito corporativas asociadas a este banco. Las tarjetas de débito se configuran en las cuentas corrientes anteriores." />
                        <div className="space-y-3">
                            {creditCards.map((card, i) => (
                                <ItemCard key={i} index={i} onRemove={() => setCreditCards((p) => p.filter((_, idx) => idx !== i))}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledInput
                                            label="Nombre de la tarjeta *"
                                            placeholder="Ej: Visa Empresas BCI"
                                            value={card.name}
                                            onChange={(e) => updateCard(i, { name: e.target.value })}
                                        />
                                        <LabeledSelect
                                            label="Moneda"
                                            value={card.currency}
                                            onChange={(v) => updateCard(i, { currency: v })}
                                            options={CURRENCY_OPTIONS}
                                        />
                                    </div>
                                </ItemCard>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-dashed"
                            onClick={() => setCreditCards((p) => [...p, emptyCard()])}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar tarjeta de crédito
                        </Button>
                    </div>
                ),
            },

            // ── 4. Préstamos ──────────────────────────────────────────────────
            {
                id: "loans",
                title: "Préstamos",
                isValid: loans.length === 0 || loansValid,
                component: (
                    <div className="space-y-4 pt-2">
                        <FormSection title="Créditos Bancarios" icon={Banknote} />
                        <SkipHint text="Opcional. Registre préstamos vigentes con este banco. Se requieren cuentas de tesorería existentes para el desembolso y la cuenta pasivo." />
                        <div className="space-y-3">
                            {loans.map((loan, i) => (
                                <ItemCard key={i} index={i} onRemove={() => setLoans((p) => p.filter((_, idx) => idx !== i))}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledInput
                                            label="N° de crédito"
                                            placeholder="Opcional"
                                            value={loan.loan_number}
                                            onChange={(e) => updateLoan(i, { loan_number: e.target.value })}
                                        />
                                        <LabeledSelect
                                            label="Moneda *"
                                            value={loan.currency}
                                            onChange={(v) => updateLoan(i, { currency: v as "CLP" | "UF" })}
                                            options={[
                                                { value: "CLP", label: "Pesos (CLP)" },
                                                { value: "UF", label: "UF" },
                                            ]}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledInput
                                            label="Capital *"
                                            placeholder="50000000"
                                            type="number"
                                            value={loan.principal}
                                            onChange={(e) => updateLoan(i, { principal: e.target.value })}
                                        />
                                        <LabeledInput
                                            label="Tasa de interés *"
                                            placeholder="0.35"
                                            type="number"
                                            value={loan.interest_rate}
                                            onChange={(e) => updateLoan(i, { interest_rate: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <LabeledSelect
                                            label="Base de tasa"
                                            value={loan.rate_basis}
                                            onChange={(v) => updateLoan(i, { rate_basis: v as "MONTHLY" | "ANNUAL" })}
                                            options={[
                                                { value: "MONTHLY", label: "Mensual" },
                                                { value: "ANNUAL", label: "Anual" },
                                            ]}
                                        />
                                        <LabeledSelect
                                            label="Amortización"
                                            value={loan.amortization_system}
                                            onChange={(v) => updateLoan(i, { amortization_system: v as "FRENCH" | "LINEAR" })}
                                            options={[
                                                { value: "FRENCH", label: "Francés" },
                                                { value: "LINEAR", label: "Lineal" },
                                            ]}
                                        />
                                        <LabeledInput
                                            label="Plazo (meses) *"
                                            placeholder="24"
                                            type="number"
                                            value={loan.term_months}
                                            onChange={(e) => updateLoan(i, { term_months: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledInput
                                            label="Fecha de inicio *"
                                            type="date"
                                            value={loan.start_date}
                                            onChange={(e) => updateLoan(i, { start_date: e.target.value })}
                                        />
                                        <LabeledInput
                                            label="1er vencimiento *"
                                            type="date"
                                            value={loan.first_due_date}
                                            onChange={(e) => updateLoan(i, { first_due_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <LabeledSelect
                                            label="Cuenta desembolso *"
                                            value={loan.disbursement_account}
                                            onChange={(v) => updateLoan(i, { disbursement_account: v })}
                                            options={disbursementOptions}
                                            placeholder="Cuenta corriente..."
                                        />
                                        <LabeledSelect
                                            label="Cuenta pasivo *"
                                            value={loan.liability_account}
                                            onChange={(v) => updateLoan(i, { liability_account: v })}
                                            options={liabilityOptions}
                                            placeholder="Tarjeta crédito..."
                                        />
                                    </div>
                                </ItemCard>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-dashed"
                            onClick={() => setLoans((p) => [...p, emptyLoan()])}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar préstamo
                        </Button>
                    </div>
                ),
            },

            // ── 5. Resumen ────────────────────────────────────────────────────
            {
                id: "summary",
                title: "Resumen",
                isValid: !isCreating,
                component: (
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-center text-muted-foreground">
                            Revise lo que se creará al confirmar.
                        </p>
                        <div className="rounded-lg border border-border/50 divide-y divide-border/40 overflow-hidden text-sm">
                            <SummaryRow icon={Landmark} label="Banco" value={bankName} />
                            {checkingAccounts.filter((a) => a.name).map((a, i) => (
                                <SummaryRow
                                    key={i}
                                    icon={Landmark}
                                    label="Cuenta corriente"
                                    value={a.name}
                                    badge={a.tenders.length > 0 ? a.tenders.map((t) => TENDER_OPTIONS.find((o) => o.value === t)?.label ?? t).join(", ") : undefined}
                                />
                            ))}
                            {creditCards.filter((c) => c.name).map((c, i) => (
                                <SummaryRow key={i} icon={CreditCard} label="Tarjeta crédito" value={c.name} />
                            ))}
                            {loans.filter((l) => l.principal).map((l, i) => (
                                <SummaryRow
                                    key={i}
                                    icon={Banknote}
                                    label="Préstamo"
                                    value={l.loan_number || `Crédito ${i + 1}`}
                                    badge={`${l.currency} ${l.principal} · ${l.term_months} meses`}
                                />
                            ))}
                            {checkingAccounts.length === 0 && creditCards.length === 0 && loans.length === 0 && (
                                <div className="px-4 py-3 text-xs text-muted-foreground italic text-center">
                                    Solo se creará el banco. Puede agregar cuentas y productos desde el detalle del banco.
                                </div>
                            )}
                        </div>
                    </div>
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [bankName, bankCode, bankSwift, checkingAccounts, creditCards, loans, isCreating, disbursementOptions, liabilityOptions, loansValid],
    )

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            icon={Landmark}
            title="Nuevo Banco"
            steps={steps}
            onComplete={handleComplete}
            isCompleting={isCreating}
            completeButtonLabel="Crear todo"
            size="lg"
        />
    )
}

function SummaryRow({
    icon: Icon,
    label,
    value,
    badge,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    badge?: string
}) {
    return (
        <div className="px-4 py-3 flex items-start gap-3">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 block">
                    {label}
                </span>
                <span className="font-bold text-sm truncate block">{value}</span>
                {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
            </div>
        </div>
    )
}
