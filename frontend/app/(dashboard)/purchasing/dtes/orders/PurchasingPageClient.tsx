"use client"

import { ToolbarCreateButton } from '@/components/shared'
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PurchaseCheckoutWizard, PurchaseOrdersView, useRefreshPurchaseOrders } from "@/features/purchasing"
import { useVatRate } from '@/hooks/useVatRate'

export default function PurchasingPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const { rate } = useVatRate()
    const refreshOrders = useRefreshPurchaseOrders()

    // ?modal=new opens the purchase wizard; ?selected= opens the order's document sheet (useDocumentSheetRoute)
    const closeWizard = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('modal')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    return (
        <>
            <PurchaseOrdersView
                viewMode="orders"
                createAction={<ToolbarCreateButton label="Nueva Orden" href="/purchasing/dtes/orders?modal=new" />}
            />
            <PurchaseCheckoutWizard
                open={searchParams.get('modal') === 'new'}
                onOpenChange={(open) => { if (!open) closeWizard() }}
                order={null}
                orderLines={[{ product: "", product_name: "", quantity: 1, uom: "", uom_name: "", unit_cost: 0, tax_rate: rate }]}
                total={0}
                onComplete={() => {
                    refreshOrders()
                    closeWizard()
                }}
            />
        </>
    )
}
