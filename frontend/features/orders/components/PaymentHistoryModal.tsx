"use client"

import { BaseModal } from '@/components/shared'
import { Collection, useEntityCollection } from "@/components/entity-view"
import { paymentHistoryEntity, paymentHistoryViews, type PaymentEntry } from "../entity-view/paymentHistory.entity"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { Landmark } from "lucide-react"

interface PaymentHistoryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: Record<string, unknown>
}

export function PaymentHistoryModal({ open, onOpenChange, order }: PaymentHistoryModalProps) {
    const payments = (order['serialized_payments'] ?? []) as PaymentEntry[]
    const collection = useEntityCollection(paymentHistoryEntity, { rows: payments }, { pagination: { mode: "none" } })

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-2 text-xl font-bold">
                    <Landmark className="h-6 w-6 text-primary" />
                    Historial de Pagos y Referencias - {order.number ? formatEntityDisplay(order.document_type === 'PURCHASE_ORDER' ? 'purchasing.purchaseorder' : 'sales.saleorder', order) : 'Borrador'}
                </div>
            }
        >
            <div className="flex flex-col mt-4">
                <Collection.Root collection={collection} label="Historial de pagos">
                    <Collection.View
                        table={paymentHistoryViews.table}
                        emptyTitle="No se han registrado pagos aún."
                        emptyDescription="Los pagos asociados a esta orden aparecerán aquí."
                    />
                </Collection.Root>
            </div>
        </BaseModal>
    )
}
