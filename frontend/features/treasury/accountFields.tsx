import { createEntityFields } from "@/components/shared"
import { DataCell } from "@/components/shared"
import { EntityBadge } from "@/components/shared"
import type { TreasuryAccount } from "@/features/treasury/types"

export const accountFields = createEntityFields<TreasuryAccount>()({
    name: {
        key: "name",
        type: "text",
        label: "Nombre de Cuenta",
    },
    account_type_display: {
        key: "account_type_display",
        type: "secondary",
        label: "Tipología",
        get: (e) => e.account_type_display || e.account_type,
    },
    accountNameCompound: {
        key: "account_name",
        type: "secondary",
        label: "Cuenta Contable",
        get: (e) => e.account_name ? `${e.account_code} - ${e.account_name}` : 'Sin vincular',
        className: (value, e) => (e.account_name ? '' : 'italic'),
    },
    bankWithProviders: {
        key: "bank_name",
        type: "computed",
        label: "Entidad Externa",
        render: (e) => {
            const bankId = e.bank
            const bankName = e.bank_name
            const providers = e.terminal_providers ?? []
            const hasBank = !!bankId
            const hasProviders = providers.length > 0
            if (!hasBank && !hasProviders) {
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Secondary>Sin entidad externa</DataCell.Secondary>
                    </div>
                )
            }
            return (
                <div className="flex flex-col items-center justify-center gap-1 w-full">
                    {hasBank && (
                        <EntityBadge
                            label="treasury.bank"
                            data={{ id: bankId, name: bankName }}
                            size="sm"
                            showIcon
                        />
                    )}
                    {providers.map((p) => (
                        <EntityBadge
                            key={p.id}
                            label="treasury.terminalprovider"
                            data={p}
                            size="sm"
                            showIcon
                        />
                    ))}
                </div>
            )
        },
    },
    current_balance: {
        key: "current_balance",
        type: "currency",
        label: "Saldo",
        currency: (e) => e.currency,
        tableOptions: { align: "right" },
    },
})
