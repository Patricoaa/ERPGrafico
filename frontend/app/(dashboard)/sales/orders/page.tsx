"use client"

import { useState, useEffect, useRef } from "react"
import { Tabs } from "@/components/ui/tabs"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { SalesOrdersClientView } from "@/features/sales"

export default function SalesOrdersPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const viewMode = (searchParams.get('tab') as 'orders' | 'notes') || 'orders'
    const legacyId = searchParams.get('id')
    const selectedId = searchParams.get('selected')
    const { openHub, isHubOpen } = useHubPanel()

    // 1. Backward compatibility for legacy ?id=
    useEffect(() => {
        if (legacyId) {
            if (viewMode === 'notes') {
                router.replace(`/sales/returns/${legacyId}`)
            } else {
                router.replace(`/sales/orders/${legacyId}`)
            }
        }
    }, [legacyId, viewMode, router])

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

    // 4. Ensure URL consistency for default tab
    useEffect(() => {
        if (!searchParams.get('tab') && !legacyId) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', 'orders')
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }, [searchParams, pathname, router, legacyId])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Tabs value={viewMode} className="w-full flex flex-col h-full gap-4">
                <div className="flex-1 min-h-0">
                    <SalesOrdersClientView viewMode={viewMode} />
                </div>
            </Tabs>
        </div>
    )
}
