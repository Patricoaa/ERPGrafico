"use client"

import {
    AlertTriangle, ArrowLeftRight, Calculator, Coins, Cpu, Download,
    HandCoins, Landmark, ShieldAlert, Undo2, UserMinus, Wallet,
} from "lucide-react"
import type { ComponentType } from "react"
import { ChoiceCard, ChoiceGroup, EmptyState } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { JustifyOption } from "@/features/pos/utils/reasons"
import type { POSJustifyAccount } from "../types"

const REASON_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    COUNTING_ERROR: Calculator,
    TRANSFER: ArrowLeftRight,
    PARTNER_WITHDRAWAL: UserMinus,
    THEFT: ShieldAlert,
    SYSTEM_ERROR: Cpu,
    CASHBACK: Undo2,
    ROUNDING: Coins,
    TIP: HandCoins,
    OTHER_IN: Download,
}

/**
 * Monto de la diferencia de efectivo (contado − esperado), lo más legible del paso.
 * Negativo = falta, positivo = sobra.
 */
export function CashDifferenceBanner({ diff, className }: { diff: number; className?: string }) {
    const isShortage = diff < 0
    return (
        <div
            role="status"
            className={cn("flex items-center justify-between gap-4 rounded-lg border border-warning/40 bg-warning/10 px-6 py-4", className)}
        >
            <span className="flex items-center gap-3 text-lg font-semibold text-foreground">
                <AlertTriangle className="size-7 shrink-0 text-warning" aria-hidden />
                {isShortage ? "Falta efectivo" : "Sobra efectivo"}
            </span>
            <span className="font-mono text-3xl font-black tabular-nums text-foreground">
                {isShortage ? "−" : "+"}{formatCurrency(Math.abs(diff))}
            </span>
        </div>
    )
}

interface CashDifferenceReasonChoiceProps {
    /** Motivos ya filtrados por la configuración contable. */
    reasons: JustifyOption[]
    value: string
    onChange: (value: string) => void
    loading?: boolean
}

/** Motivo de la diferencia como tarjetas táctiles: tocar elige (el flujo decide si avanza). */
export function CashDifferenceReasonChoice({ reasons, value, onChange, loading = false }: CashDifferenceReasonChoiceProps) {
    if (loading) {
        return <p role="status" className="text-center text-lg text-muted-foreground">Cargando motivos…</p>
    }
    return (
        <ChoiceGroup
            label="Motivo de la diferencia"
            columns={reasons.length > 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}
            activation="focus"
            className="gap-4"
        >
            {reasons.map(opt => (
                <ChoiceCard
                    key={opt.value}
                    size="touch"
                    icon={REASON_ICONS[opt.value] ?? Calculator}
                    title={opt.label}
                    description={opt.description}
                    selected={value === opt.value}
                    onSelect={() => onChange(opt.value)}
                />
            ))}
        </ChoiceGroup>
    )
}

interface TransferAccountChoiceProps {
    accounts: POSJustifyAccount[]
    value: string | null
    onChange: (id: string) => void
    /** Saldo mínimo que debe tener la cuenta (traspaso entrante); las que no alcanzan quedan deshabilitadas. */
    minBalance?: number
    /** Texto del grupo para lectores de pantalla. */
    label: string
}

/** Cuenta de origen/destino de un traspaso como tarjetas táctiles, con su saldo. */
export function TransferAccountChoice({ accounts, value, onChange, minBalance, label }: TransferAccountChoiceProps) {
    if (accounts.length === 0) {
        return (
            <EmptyState
                variant="compact"
                icon={Wallet}
                title="No hay otras cuentas disponibles"
                description="Pida a administración que active una caja o cuenta bancaria, o elija otro motivo."
            />
        )
    }
    return (
        <ChoiceGroup
            label={label}
            columns={accounts.length > 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}
            activation="focus"
            className="gap-4"
        >
            {accounts.map(acc => {
                const short = minBalance !== undefined && acc.current_balance !== null && acc.current_balance < minBalance
                return (
                    <ChoiceCard
                        key={acc.id}
                        size="touch"
                        icon={acc.account_type === "CASH" ? Wallet : Landmark}
                        meta={acc.account_type === "CASH" ? "Caja" : "Banco"}
                        title={acc.name}
                        description={short ? `Saldo insuficiente: faltan ${formatCurrency((minBalance ?? 0) - (acc.current_balance ?? 0))}` : undefined}
                        footer={acc.current_balance !== null ? (
                            <span className="text-base text-muted-foreground">
                                Saldo <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(acc.current_balance)}</span>
                            </span>
                        ) : undefined}
                        disabled={short}
                        selected={value === acc.id.toString()}
                        onSelect={() => onChange(acc.id.toString())}
                    />
                )
            })}
        </ChoiceGroup>
    )
}
