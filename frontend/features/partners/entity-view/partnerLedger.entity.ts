// Side-effect import: ensures the `ledgerDate` kind is registered before this entity renders.
import "@/features/accounting"

import { defineEntity } from "@/components/entity-view"
import type { PartnerTransaction } from "@/features/contacts"

export type PartnerLedgerRow = PartnerTransaction & { balance_after: number }

const INFLOW_TYPES = [
    "CAPITAL_CASH",
    "CAPITAL_INVENTORY",
    "TRANSFER_IN",
    "REINVESTMENT",
    "RETAINED",
]

const OUTFLOW_TYPES = [
    "WITHDRAWAL",
    "PROV_WITHDRAWAL",
    "REDUCTION",
    "TRANSFER_OUT",
    "LOSS_ABSORB",
    "DIVIDEND_PAY",
]

export const isInflowType = (type: string) => INFLOW_TYPES.includes(type)

export const isOutflowType = (type: string) => OUTFLOW_TYPES.includes(type)

export const partnerTxDirection = (type: string): "inflow" | "outflow" | "neutral" =>
    isInflowType(type) ? "inflow" : isOutflowType(type) ? "outflow" : "neutral"

export const PARTNER_TRANSACTION_TYPE_OPTIONS = [
    { value: "SUBSCRIPTION", label: "Suscripción de Capital" },
    { value: "REDUCTION", label: "Reducción de Capital" },
    { value: "CAPITAL_CASH", label: "Aporte Efectivo" },
    { value: "CAPITAL_INVENTORY", label: "Aporte en Bienes" },
    { value: "PROV_WITHDRAWAL", label: "Retiro Provisorio" },
    { value: "WITHDRAWAL", label: "Retiro de Utilidades" },
    { value: "DIVIDEND", label: "Distribución" },
    { value: "DIVIDEND_PAY", label: "Pago de Dividendo" },
    { value: "REINVESTMENT", label: "Reinversión" },
    { value: "RETAINED", label: "Utilidades Retenidas" },
    { value: "LOSS_ABSORB", label: "Absorción" },
    { value: "TRANSFER_IN", label: "Transferencia (In)" },
    { value: "TRANSFER_OUT", label: "Transferencia (Out)" },
]

export const partnerLedgerEntity = defineEntity<PartnerLedgerRow>()((f) => ({
    title: "Libro de Socio",
    fields: {
        date: f.value("ledgerDate", (tx) => ({ date: tx.date, createdAt: tx.created_at }), { label: "Fecha" }),
        transactionType: f.text((tx) => tx.transaction_type_display, { label: "Tipo", tone: "secondary" }),
        amount: f.flow("amount", { label: "Monto", direction: (tx) => partnerTxDirection(tx.transaction_type) }),
        balanceAfter: f.money("balance_after", { label: "Saldo" }),
    },
}))

export const partnerLedgerViews = partnerLedgerEntity.views({
    table: {
        columns: ["date", "transactionType", "amount", "balanceAfter"],
        primary: "date",
    },
})
