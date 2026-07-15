import { createEntityFields } from "@/components/shared"
import type { TerminalBatch } from "@/features/treasury/types"

export const terminalBatchFields = createEntityFields<TerminalBatch>()({
    netAmount: {
        key: "net_amount",
        type: "currency",
        label: "Depósito Neto",
    },
    status: {
        key: "status",
        type: "status",
        label: "Estado",
    },
})
