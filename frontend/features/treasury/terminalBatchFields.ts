import { createEntityFields } from "@/components/shared"
import type { TerminalBatch } from "@/features/treasury/types"

export const terminalBatchFields = createEntityFields<TerminalBatch>()({
    transactionCount: {
        key: "transaction_count",
        type: "number",
        label: "Transacciones",
        cardPlacement: "body",
    },
    netAmount: {
        key: "net_amount",
        type: "currency",
        label: "Depósito Neto",
        cardPlacement: "body",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
})
