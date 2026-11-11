"use client"

import {
    AlertTriangle, ArrowLeftRight, Calculator, CircleHelp, Coins, Cpu, Download,
    HandCoins, Landmark, Receipt, ShieldAlert, Undo2, UserMinus, UserRound, Wallet,
} from "lucide-react"
import type { ComponentType } from "react"
import { ChoiceCard, ChoiceGroup, EmptyState } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { JustifyOption } from "@/features/pos/utils/reasons"
import type { POSJustifyAccount, POSJustifyPartner } from "../types"
import { TOUCH_ROW_GAP, touchRow } from "./flow/flowParts"

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
    OTHER_OUT: Receipt,
    UNKNOWN: CircleHelp,
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
            className={cn("mx-auto flex w-full max-w-4xl items-center justify-between gap-4 rounded-lg border border-warning/40 bg-warning/10 px-6 py-4", className)}
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
            columns={touchRow(reasons.length)}
            activation="focus"
            className={TOUCH_ROW_GAP}
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
            columns={touchRow(accounts.length)}
            activation="focus"
            className={TOUCH_ROW_GAP}
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
                            <span className="text-sm text-muted-foreground @[17rem]:text-base">
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

interface PartnerChoiceProps {
    partners: POSJustifyPartner[]
    value: string | null
    onChange: (id: string) => void
}

/** Socio que retira el efectivo (ADR-0131), como tarjetas táctiles. */
export function PartnerChoice({ partners, value, onChange }: PartnerChoiceProps) {
    if (partners.length === 0) {
        return (
            <EmptyState
                variant="compact"
                icon={UserRound}
                title="No hay socios registrados"
                description="Pida a administración que marque a la persona como socio en Contactos, o elija otro motivo."
            />
        )
    }
    return (
        <ChoiceGroup label="Socio que retira" columns={touchRow(partners.length)} activation="focus" className={TOUCH_ROW_GAP}>
            {partners.map(p => (
                <ChoiceCard
                    key={p.id}
                    size="touch"
                    icon={UserRound}
                    meta="Socio"
                    title={p.name}
                    selected={value === p.id.toString()}
                    onSelect={() => onChange(p.id.toString())}
                />
            ))}
        </ChoiceGroup>
    )
}
