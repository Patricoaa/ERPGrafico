"use client"

import { lazy, Suspense, useState, useEffect, useRef } from "react"
import { TableSkeleton } from "@/components/shared"
import { Tabs } from "@/components/ui/tabs"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

export default function SalesOrdersPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const viewMode = (searchParams.get('tab') as 'orders' | 'notes') || 'orders'
    const legacyId = searchParams.get('id')
    const selectedId = searchParams.get('selected')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
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
    const [hubEverOpened, setHubEverOpened] = useState(false)

    useEffect(() => {
        if (selectedId) {
            openHub({ orderId: Number(selectedId), type: 'sale' })
        }
    }, [selectedId, openHub])

    // Track when the hub successfully opens
    useEffect(() => {
        if (isHubOpen && selectedId) {
            setHubEverOpened(true)
        }
    }, [isHubOpen, selectedId])

    // 3. Clean up URL when hub closes (only if it was actually opened first)
    useEffect(() => {
        if (hubEverOpened && !isHubOpen && selectedId) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('selected')
            const query = params.toString()
            setHubEverOpened(false) // reset
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, hubEverOpened, selectedId, pathname, searchParams, router])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    return (
        <Tabs value={viewMode} className="w-full pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <SalesOrdersClientView
                    viewMode={viewMode}
                    isCreateModalOpen={isCreateModalOpen}
                    setCreateModalOpen={setIsCreateModalOpen}
                />
            </Suspense>
        </Tabs>
    )
}
