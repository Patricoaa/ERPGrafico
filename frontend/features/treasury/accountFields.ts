import { createEntityFields } from "@/components/shared"
import type { TreasuryAccount } from "@/features/treasury/types"

export const accountFields = createEntityFields<TreasuryAccount>()({
    name: { key: "name", type: "text", label: "Nombre de Cuenta" },
    account_type_display: {
        key: "account_type_display",
        type: "text",
        label: "Tipología",
        get: (e) => e.account_type_display || e.account_type,
    },
    current_balance: {
        key: "current_balance",
        type: "currency",
        label: "Saldo",
        currency: (e) => e.currency,
        tableOptions: { align: "right" },
    },
    account_code: {
        key: "account_code",
        type: "code",
        label: "Cta. Contable",
        get: (e) => e.account_code,
    },
    account_name: {
        key: "account_name",
        type: "text",
        label: "Nombre Cuenta",
        get: (e) => e.account_name,
    },
    bank_name: {
        key: "bank_name",
        type: "text",
        label: "Entidad",
        get: (e) => e.bank_name,
    },
})
