"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell, StatusBadge } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import type { UnbilledItemRow, UnbilledItemSource, UpcomingInstallment } from "../types"

export type { UnbilledItemRow }

interface UnbilledPurchaseRefValue {
    source: UnbilledItemSource
    originalInstallment: UpcomingInstallment | null
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        unbilledPurchaseRef: {
            value: UnbilledPurchaseRefValue | null
            options: Record<never, never>
        }
    }
}

function PurchaseRefCell({ value }: { value: UnbilledPurchaseRefValue | null }) {
    const { openEntity } = useGlobalModals()
    if (!value || value.source !== "installment" || !value.originalInstallment) return null
    const inst = value.originalInstallment
    return (
        <div className="flex flex-col items-center gap-0.5 w-full">
            {inst.partner_name && (
                <span className="text-3xs text-muted-foreground truncate max-w-[140px] leading-tight">
                    {inst.partner_name}
                </span>
            )}
            <Button
                variant="ghost"
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    if (inst.purchase_order_id) {
                        openEntity("purchasing.purchaseorder", inst.purchase_order_id)
                    }
                }}
                className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm transition-shadow h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none"
            >
                <StatusBadge
                    status={inst.purchase_order_display_id ? "info" : "muted"}
                    label={inst.purchase_order_display_id || "Sin OC"}
                />
            </Button>
        </div>
    )
}

registerValueKind("unbilledPurchaseRef", {
    format: () => "",
    sortValue: () => null,
    render: ({ value }) => <PurchaseRefCell value={value} />,
    inline: () => <DataCell.Empty inline />,
})

export const unbilledChargeEntity = defineEntity<UnbilledItemRow>()((f) => ({
    title: "Cargos No Facturados",
    fields: {
        chargeType: f.status(
            (i) => ({ status: i.chargeType ?? i.source, label: i.chargeTypeDisplay ?? i.source }),
            { label: "Tipo" },
        ),
        date: f.date("date", { label: "Fecha" }),
        installmentFraction: f.text(
            (i) => {
                if (i.source === "pending") return "N/A"
                if (!i.installmentNumber || !i.totalInstallments) return null
                return `${i.installmentNumber}/${i.totalInstallments}`
            },
            { label: "Cuota" },
        ),
        description: f.text((i) => i.notes, { label: "Descripción" }),
        amount: f.money((i) => i.amount, {
            label: "Monto",
            currency: (i) => i.currency ?? "CLP",
        }),
        purchaseRef: f.value(
            "unbilledPurchaseRef",
            (i) => ({ source: i.source, originalInstallment: i.originalInstallment }),
            { label: "Compra asociada" },
        ),
        reference: f.text("reference", { label: "Referencia" }),
    },
}))

export const unbilledChargeViews = unbilledChargeEntity.views({
    table: {
        columns: ["date", "installmentFraction", "purchaseRef", "amount", "chargeType"],
        primary: "reference",
    },
    card: {
        title: "reference",
        subtitle: ["chargeType", "date"],
        meta: ["installmentFraction", "description"],
        trailing: ["amount"],
        media: { tone: "warning" },
    },
})
