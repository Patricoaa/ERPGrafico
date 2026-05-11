"use client"

import { lazy, Suspense, useEffect, useState, use } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

const PurchasingOrdersClientView = lazy(() =>
    import("./components/PurchasingOrdersClientView").then(m => ({ default: m.PurchasingOrdersClientView }))
)

interface PageProps {
    searchParams: Promise<{ modal?: string, selected?: string }>
}

export default function PurchaseOrdersPage({ searchParams }: PageProps) {
    const params = use(searchParams)
    const modalOpen = params.modal === 'new'
    
    const router = useRouter()
    const pathname = usePathname()
    const nextSearchParams = useSearchParams()
    
    const selectedId = nextSearchParams.get('selected')
    const { openHub, isHubOpen } = useHubPanel()
    const [hubEverOpened, setHubEverOpened] = useState(false)

    // 1. Open Hub panel if ?selected= is present
    useEffect(() => {
        if (selectedId) {
            openHub({ orderId: Number(selectedId), type: 'purchase' })
        }
    }, [selectedId, openHub])

    // 2. Track when the hub successfully opens
    useEffect(() => {
        if (isHubOpen && selectedId) {
            setHubEverOpened(true)
        }
    }, [isHubOpen, selectedId])

    // 3. Clean up URL when hub closes (only if it was actually opened first)
    useEffect(() => {
        if (hubEverOpened && !isHubOpen && selectedId) {
            const urlParams = new URLSearchParams(nextSearchParams.toString())
            urlParams.delete('selected')
            const query = urlParams.toString()
            setHubEverOpened(false) // reset
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, hubEverOpened, selectedId, pathname, nextSearchParams, router])

    const createAction = (
        <ToolbarCreateButton
            label="Nueva Orden"
            href="/purchasing/orders?modal=new"
        />
    )

    return (
        <Suspense fallback={<LoadingFallback />}>
            <PurchasingOrdersClientView viewMode="orders" externalOpenCheckout={modalOpen} createAction={createAction} />
        </Suspense>
    )
}
