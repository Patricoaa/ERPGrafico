"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { unifiedPaymentEntity, unifiedPaymentViews, type UnifiedPayment } from "../entity-view/unifiedPayment.entity"
import type { Payroll } from "@/types/hr"

interface PayrollPaymentsDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payroll: Payroll | null
    allPayments: UnifiedPayment[]
}

export function PayrollPaymentsDrawer({ open, onOpenChange, payroll, allPayments }: PayrollPaymentsDrawerProps) {
    const payments = React.useMemo(
        () => (payroll ? allPayments.filter((p) => p.payroll_display_id === payroll.display_id) : []),
        [payroll, allPayments],
    )

    const collection = useEntityCollection(unifiedPaymentEntity, { rows: payments }, { pagination: { mode: "none" } })

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>
                        Pagos — {payroll?.display_id ?? ""}{" "}
                        <span className="text-muted-foreground font-normal text-sm">{payroll?.period_label}</span>
                    </SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col gap-2">
                    <Collection.Root collection={collection} label="Pagos de liquidación">
                        <Collection.View
                            table={unifiedPaymentViews.table}
                            emptyTitle="Sin pagos registrados"
                            emptyDescription="Esta liquidación no tiene pagos ni anticipos vinculados."
                        />
                    </Collection.Root>
                </div>
            </SheetContent>
        </Sheet>
    )
}
