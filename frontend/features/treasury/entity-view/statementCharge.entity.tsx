"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import { parseDateOnly } from "@/lib/utils"
import type { StatementChargeRow, StatementChargeSource, StatementInstallment } from "../card-statements/types"
import type { CardPurchaseGroup } from "../types"

export type { StatementChargeRow }

interface StatementChargeDescValue {
    source: StatementChargeSource
    reference: string | null
    notes: string | null
    date: string
    installmentNumber: number | null
    totalInstallments: number | null
    movementTypeDisplay: string | null
    originalMovementId: number | null
    purchaseGroupDetail: CardPurchaseGroup | null
    originalInstallment: StatementInstallment | null
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        statementChargeDesc: {
            value: StatementChargeDescValue | null
            options: Record<never, never>
        }
    }
}

registerValueKind("statementChargeDesc", {
    format: (v) => v?.reference ?? v?.movementTypeDisplay ?? "",
    sortValue: (v) => v?.reference ?? v?.movementTypeDisplay ?? null,
    render: ({ value: v }) => {
        if (!v) return <DataCell.Empty />
        const inst = v.originalInstallment
        const group = v.purchaseGroupDetail
        const mainText =
            v.source === "installment"
                ? `Cuota #${v.installmentNumber} de ${v.totalInstallments}${inst?.partner_name ? ` — ${inst.partner_name}` : ""}`
                : v.source === "pending"
                    ? `${v.movementTypeDisplay || "Cargo"}${v.reference ? `: ${v.reference}` : ""}`
                    : v.reference ?? v.movementTypeDisplay ?? `Movimiento #${v.originalMovementId}`
        const subText =
            v.source === "installment"
                ? [inst?.purchase_order_display_id, v.reference].filter(Boolean).join(" — ") || inst?.partner_name || null
                : v.source === "pending"
                    ? parseDateOnly(v.date).toLocaleDateString("es-CL", { year: "numeric", month: "long" })
                    : v.notes ?? null
        return (
            <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-medium">{mainText}</span>
                {subText && <span className="text-3xs text-muted-foreground truncate max-w-[250px]">{subText}</span>}
                {group?.partner_name && (
                    <span className="text-3xs text-muted-foreground truncate max-w-[200px]">{group.partner_name}</span>
                )}
                {group?.client_reference && (
                    <span className="text-3xs text-muted-foreground truncate max-w-[200px]">{group.client_reference}</span>
                )}
            </div>
        )
    },
    inline: ({ value: v }) =>
        v ? (
            <DataCell.Text inline>
                <span className="truncate">{v.reference ?? v.movementTypeDisplay ?? ""}</span>
            </DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

export const statementChargeEntity = defineEntity<StatementChargeRow>()((f) => ({
    title: "Cargos del Estado",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        description: f.value(
            "statementChargeDesc",
            (r) => ({
                source: r.source,
                reference: r.reference,
                notes: r.notes,
                date: r.date,
                installmentNumber: r.installmentNumber,
                totalInstallments: r.totalInstallments,
                movementTypeDisplay: r.movementTypeDisplay,
                originalMovementId: r.originalMovement?.id ?? null,
                purchaseGroupDetail: r.purchaseGroupDetail,
                originalInstallment: r.originalInstallment,
            }),
            { label: "Descripción" },
        ),
        installmentFraction: f.text(
            (r) =>
                r.installmentNumber && r.totalInstallments
                    ? `${r.installmentNumber}/${r.totalInstallments}`
                    : null,
            { label: "Cuota" },
        ),
        amount: f.money((r) => r.amount, { label: "Monto" }),
        movementType: f.status(
            (r) => ({ status: r.movementType ?? "", label: r.movementTypeDisplay ?? "" }),
            { label: "Tipo" },
        ),
    },
}))

export const statementChargeViews = statementChargeEntity.views({
    table: {
        columns: ["date", "description", "installmentFraction", "amount", "movementType"],
        primary: "description",
    },
})
