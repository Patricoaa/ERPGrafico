"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { SalesOrdersClientView } from "@/features/sales"

export default function SalesOrdersPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const legacyId = searchParams.get('id')
    const selectedId = searchParams.get('selected')
    const { openHub, isHubOpen } = useHubPanel()

    // 1. Backward compatibility for legacy ?id=
    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/orders/${legacyId}`)
        }
    }, [legacyId, router])

    // 2. Open Hub panel if ?selected= is present (ADR-0020 equivalent for Orders)
    const hubEverOpenedRef = useRef(false)

    useEffect(() => {
        if (selectedId) {
            openHub({ orderId: Number(selectedId), type: 'sale' })
        }
    }, [selectedId, openHub])

    // Track when the hub successfully opens
    useEffect(() => {
        if (isHubOpen && selectedId) hubEverOpenedRef.current = true
    }, [isHubOpen, selectedId])

    // 3. Clean up URL when hub closes (only if it was actually opened first)
    useEffect(() => {
        if (hubEverOpenedRef.current && !isHubOpen && selectedId) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('selected')
            const query = params.toString()
            hubEverOpenedRef.current = false
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, selectedId, pathname, searchParams, router])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <SalesOrdersClientView viewMode="orders" />
            </div>
        </div>
    )
}
