"use client"

import { ToolbarCreateButton } from '@/components/shared'
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PurchaseCheckoutWizard, PurchaseOrdersView, useRefreshPurchaseOrders } from "@/features/purchasing"
import { useVatRate } from '@/hooks/useVatRate'
import { EntityPanelTab } from '@/components/providers'

export default function PurchasingPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const { rate } = useVatRate()
    const refreshOrders = useRefreshPurchaseOrders()

    const isNew = searchParams.get('modal') === 'new'

    // ?modal=new opens the purchase wizard; ?selected= opens the order's document sheet (useDocumentSheetRoute)
    const closeWizard = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('modal')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PurchaseOrdersView
                viewMode="orders"
                createAction={<ToolbarCreateButton label="Nueva Orden" href="/purchasing/dtes/orders?modal=new" />}
            />
            <EntityPanelTab
                label="purchasing.purchaseorder"
                id={null}
                open={isNew}
                onClose={closeWizard}
            >
                {(open) => (
                    <PurchaseCheckoutWizard
                        open={open}
                        onOpenChange={(isOpen) => { if (!isOpen) closeWizard() }}
                        order={null}
                        orderLines={[{ product: "", product_name: "", quantity: 1, uom: "", uom_name: "", unit_cost: 0, tax_rate: rate }]}
                        total={0}
                        onComplete={() => {
                            refreshOrders()
                            closeWizard()
                        }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}
