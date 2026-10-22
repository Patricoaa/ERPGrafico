"use client"

import { Chip } from "@/components/shared"
import { Input } from "@/components/ui/input"
import { defineEntity, registerValueKind, formatMoneyValue, type ValueRenderProps } from "@/components/entity-view"

export type PartnerEntryRow = {
    contact_id: number
    name: string
    amount: number
    _totalCapital: number
    _index: number
    _onAmountChange: (index: number, value: string) => void
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        partnerEntryName: { value: PartnerEntryRow; options: Record<never, never> }
        partnerEntryAmountInput: { value: PartnerEntryRow; options: Record<never, never> }
        partnerEntryPercentage: { value: PartnerEntryRow; options: Record<never, never> }
    }
}

function PartnerEntryNameCell({ value: row }: ValueRenderProps<"partnerEntryName">) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-3xs font-bold text-primary shrink-0">
                #{row._index + 1}
            </div>
            <span className="font-medium text-sm">{row.name}</span>
        </div>
    )
}

function PartnerEntryAmountInputCell({ value: row }: ValueRenderProps<"partnerEntryAmountInput">) {
    return (
        <div className="relative w-full max-w-[200px] ml-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
            <Input
                type="number"
                value={row.amount || ""}
                onChange={(e) => row._onAmountChange(row._index, e.target.value)}
                className="pl-7 text-right font-mono h-9"
                placeholder="0"
            />
        </div>
    )
}

function PartnerEntryPercentageCell({ value: row }: ValueRenderProps<"partnerEntryPercentage">) {
    const percentage = row._totalCapital > 0 ? (row.amount / row._totalCapital) * 100 : 0
    return (
        <Chip size="sm" intent="primary" className="font-bold justify-center w-full">
            {percentage.toFixed(2)}%
        </Chip>
    )
}

let registered = false
function registerPartnerEntryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("partnerEntryName", {
        format: (r) => r.name,
        sortValue: (r) => r._index,
        render: PartnerEntryNameCell,
    })
    registerValueKind("partnerEntryAmountInput", {
        format: (r) => formatMoneyValue(r.amount),
        sortValue: (r) => r.amount,
        render: PartnerEntryAmountInputCell,
    })
    registerValueKind("partnerEntryPercentage", {
        format: (r) => r._totalCapital > 0
            ? `${((r.amount / r._totalCapital) * 100).toFixed(2)}%`
            : "0%",
        render: PartnerEntryPercentageCell,
    })
}

registerPartnerEntryValueKinds()

export const partnerEntryEntity = defineEntity<PartnerEntryRow>()((f) => ({
    title: "Socio",
    rowId: (r) => r.contact_id,
    fields: {
        name: f.value("partnerEntryName", (r) => r, { label: "Socio", sortable: false }),
        amount: f.value("partnerEntryAmountInput", (r) => r, { label: "Monto Aportado", sortable: false, align: "end" }),
        percentage: f.value("partnerEntryPercentage", (r) => r, { label: "Participación", sortable: false, align: "center" }),
    },
}))

export const partnerEntryViews = partnerEntryEntity.views({
    table: {
        columns: ["name", "amount", "percentage"],
        primary: "name",
    },
})
