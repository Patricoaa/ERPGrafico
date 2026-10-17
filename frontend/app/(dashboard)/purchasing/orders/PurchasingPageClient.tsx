"use client"

import { ToolbarCreateButton } from '@/components/shared'
import { useSearchParams } from "next/navigation"
import { PurchasingOrdersClientView } from "./components/PurchasingOrdersClientView"
import type { PurchaseOrderAPI } from "@/features/purchasing"
import type { Invoice } from "@/features/billing"

interface PurchasingPageClientProps {
    initialOrders?: PurchaseOrderAPI[]
    initialNotes?: Invoice[]
}

export default function PurchasingPageClient({ initialOrders, initialNotes }: PurchasingPageClientProps) {
    const searchParams = useSearchParams()

    const modalOpen = searchParams.get('modal') === 'new'
    // ?selected= abre la ficha documental de la OC desde la propia lista (useDocumentSheetRoute)

    const createAction = (
        <ToolbarCreateButton
            label="Nueva Orden"
            href="/purchasing/orders?modal=new"
        />
    )

    return (
        <PurchasingOrdersClientView
            viewMode="orders"
            externalOpenCheckout={modalOpen}
            createAction={createAction}
            initialOrders={initialOrders}
            initialNotes={initialNotes}
        />
    )
}
