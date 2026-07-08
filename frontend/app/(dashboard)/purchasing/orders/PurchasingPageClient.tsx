"use client"

import { useEffect, useRef } from "react"
import { ToolbarCreateButton } from '@/components/shared'
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { PurchasingOrdersClientView } from "./components/PurchasingOrdersClientView"
import type { PurchaseOrderAPI } from "@/features/purchasing"
import type { Invoice } from "@/features/billing"

interface PurchasingPageClientProps {
    initialOrders?: PurchaseOrderAPI[]
    initialNotes?: Invoice[]
}

export default function PurchasingPageClient({ initialOrders, initialNotes }: PurchasingPageClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedId = searchParams.get('selected')
    const modalOpen = searchParams.get('modal') === 'new'
    const { openHub, isHubOpen } = useHubPanel()
    const hubEverOpenedRef = useRef(false)

    // 1. Open Hub panel if ?selected= is present
    useEffect(() => {
        if (selectedId) {
            openHub({ orderId: Number(selectedId), type: 'purchase' })
        }
    }, [selectedId, openHub])

    // 2. Track when the hub successfully opens
    useEffect(() => {
        if (isHubOpen && selectedId) hubEverOpenedRef.current = true
    }, [isHubOpen, selectedId])

    // 3. Clean up URL when hub closes (only if it was actually opened first)
    useEffect(() => {
        if (hubEverOpenedRef.current && !isHubOpen && selectedId) {
            const urlParams = new URLSearchParams(searchParams.toString())
            urlParams.delete('selected')
            const query = urlParams.toString()
            hubEverOpenedRef.current = false
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, selectedId, pathname, searchParams, router])

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
