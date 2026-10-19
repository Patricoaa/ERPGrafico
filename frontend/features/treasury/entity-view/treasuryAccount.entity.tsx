"use client"

import { Wallet, Landmark, CreditCard, HandCoins, ArrowRightLeft, FileText, type LucideIcon } from "lucide-react"
import { DataCell, EntityBadge } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps, type CardTone } from "@/components/entity-view"
import type { TreasuryAccount } from "../types"

const ACCOUNT_TYPE_ICON: Record<string, LucideIcon> = {
    CASH: Wallet,
    CHECKING: Landmark,
    CREDIT_CARD: CreditCard,
    LOAN: HandCoins,
    BRIDGE: ArrowRightLeft,
    CHECK_PORTFOLIO: FileText,
    ISSUED_CHECKS: FileText,
}

const ACCOUNT_TYPE_TONE: Record<string, CardTone> = {
    CASH: "success",
    CHECKING: "info",
    CREDIT_CARD: "warning",
    LOAN: "destructive",
    BRIDGE: "primary",
    CHECK_PORTFOLIO: "muted",
    ISSUED_CHECKS: "warning",
}

function accountTypeKey(a: TreasuryAccount): string {
    return a.account_type?.toUpperCase() ?? ""
}

/** Feature extension: the bank + POS terminal providers linked to a treasury account — 0..N badges. */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        treasuryAccountLinks: { value: TreasuryAccount; options: Record<never, never> }
    }
}

function TreasuryAccountLinksCell({ value: acc }: ValueRenderProps<"treasuryAccountLinks">) {
    const providers = acc.terminal_providers ?? []
    if (!acc.bank && providers.length === 0) {
        return (
            <div className="flex justify-center w-full">
                <DataCell.Secondary>Sin entidad externa</DataCell.Secondary>
            </div>
        )
    }
    return (
        <div className="flex flex-col items-center justify-center gap-1 w-full">
            {acc.bank && <EntityBadge label="treasury.bank" data={{ id: acc.bank, name: acc.bank_name }} size="sm" showIcon />}
            {providers.map((p) => (
                <EntityBadge key={p.id} label="treasury.terminalprovider" data={p} size="sm" showIcon />
            ))}
        </div>
    )
}

let registered = false
function registerTreasuryAccountValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("treasuryAccountLinks", {
        format: (acc) => acc.bank_name ?? (acc.terminal_providers?.map((p) => p.name).join(", ") ?? ""),
        render: TreasuryAccountLinksCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerTreasuryAccountValueKinds()

/** Treasury accounts (ADR-0087 oleada C1). Replaces accountFields.tsx (1 computed). */
export const treasuryAccountEntity = defineEntity<TreasuryAccount>()((f) => ({
    label: "treasury.treasuryaccount",
    fields: {
        name: f.text("name", { label: "Nombre de Cuenta" }),
        accountType: f.text((a) => a.account_type_display || a.account_type, { label: "Tipología", tone: "secondary" }),
        linkedAccount: f.text((a) => (a.account_name ? `${a.account_code} - ${a.account_name}` : "Sin vincular"), { label: "Cuenta Contable", tone: "secondary" }),
        links: f.value("treasuryAccountLinks", (a) => a, { label: "Entidad Externa" }),
        balance: f.money("current_balance", { label: "Saldo", currency: (a) => a.currency }),
    },
}))

export const treasuryAccountViews = treasuryAccountEntity.views({
    table: { columns: ["name", "accountType", "linkedAccount", "links", "balance"], primary: "name" },
    card: {
        title: "name",
        subtitle: ["accountType", "linkedAccount"],
        trailing: ["balance"],
        meta: ["links"],
        media: {
            iconFor: (a) => ACCOUNT_TYPE_ICON[accountTypeKey(a)] ?? Wallet,
            tone: (a) => ACCOUNT_TYPE_TONE[accountTypeKey(a)] ?? "default",
        },
    },
})
