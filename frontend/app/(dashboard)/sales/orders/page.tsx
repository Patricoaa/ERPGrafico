"use client"

import { lazy, Suspense, useState } from "react"
import { TableSkeleton } from "@/components/shared"
import { Tabs } from "@/components/ui/tabs"
import { useSearchParams, useRouter } from "next/navigation"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

export default function SalesOrdersPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const viewMode = (searchParams.get('view') as 'orders' | 'notes') || 'orders'
    const legacyId = searchParams.get('id')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    useEffect(() => {
        if (legacyId) {
            // Temporary proxy redirect for legacy ?id= pattern (F7 T-72)
            if (viewMode === 'notes') {
                router.replace(`/sales/returns/${legacyId}`)
            } else {
                router.replace(`/sales/orders/${legacyId}`)
            }
        }
    }, [legacyId, viewMode, router])

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
