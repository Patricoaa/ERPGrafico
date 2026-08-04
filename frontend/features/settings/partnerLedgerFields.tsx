import { createEntityFields } from "@/components/shared"
import type { PartnerTransaction } from "@/features/contacts"
import { formatPlainDate } from "@/lib/utils"

export type PartnerLedgerRow = PartnerTransaction & { balance_after: number }

const INFLOW_TYPES = [
    'CAPITAL_CASH',
    'CAPITAL_INVENTORY',
    'TRANSFER_IN',
    'REINVESTMENT',
    'RETAINED',
]

const OUTFLOW_TYPES = [
    'WITHDRAWAL',
    'PROV_WITHDRAWAL',
    'REDUCTION',
    'TRANSFER_OUT',
    'LOSS_ABSORB',
    'DIVIDEND_PAY',
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

export const partnerLedgerFields = createEntityFields<PartnerLedgerRow>()({
    date: {
        key: "date",
        type: "computed",
        label: "Fecha",
        placement: "detail",
        render: (tx) => (
            <div className="flex justify-center items-center w-full text-center text-sm font-sans font-medium text-foreground whitespace-nowrap">
                {formatPlainDate(tx.date)}
                {tx.created_at && (
                    <span className="text-xs text-muted-foreground/60 ml-1.5">
                        {new Date(tx.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        ),
    },
    transactionType: {
        key: "transaction_type",
        type: "secondary",
        label: "Tipo",
        placement: "detail",
        get: (tx) => tx.transaction_type_display,
    },
    amount: {
        key: "amount",
        type: "currencyFlow",
        label: "Monto",
        placement: "detail",
        direction: (tx) => partnerTxDirection(tx.transaction_type),
    },
    balanceAfter: {
        key: "balance_after",
        type: "currency",
        label: "Saldo",
        placement: "detail",
        get: (tx) => tx.balance_after,
        className: "font-mono font-black",
        tableOptions: {
            align: "right",
            accessorFn: (tx) => tx.balance_after,
        },
    },
})
