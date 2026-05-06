"use client"

import { lazy, Suspense, useState } from "react"
import { TableSkeleton } from "@/components/shared"
import { Tabs } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"

const SalesOrdersClientView = lazy(() =>
    import("@/features/sales").then(m => ({ default: m.SalesOrdersClientView }))
)

export default function SalesOrdersPage() {
    const searchParams = useSearchParams()
    const viewMode = (searchParams.get('view') as 'orders' | 'notes') || 'orders'
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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
