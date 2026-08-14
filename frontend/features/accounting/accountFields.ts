import { createEntityFields } from "@/components/shared"
import type { Account } from "./types"

export const accountFields = createEntityFields<Account>()({
    code: {
        key: "code",
        type: "code",
        label: "Código",
        tableOptions: { align: "left" },
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
        tableOptions: { align: "left" },
    },
    accountType: {
        key: "account_type",
        type: "chip-category",
        domain: "account_type",
        label: "Tipo",
    },
    debitTotal: {
        key: "debit_total",
        type: "currency",
        label: "Debe",
        placement: "detail",
    },
    creditTotal: {
        key: "credit_total",
        type: "currency",
        label: "Haber",
        placement: "detail",
    },
    balance: {
        key: "balance",
        type: "currency",
        label: "Saldo",
        placement: "detail",
    },
})
