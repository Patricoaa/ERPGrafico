"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SalesOrdersClientView } from "@/features/sales"

export default function SalesOrdersPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const legacyId = searchParams.get('id')

    // Backward compatibility for legacy ?id=
    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/orders/${legacyId}`)
        }
    }, [legacyId, router])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    // ?selected= abre la ficha documental de la OV desde la propia lista (useDocumentSheetRoute)
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                <SalesOrdersClientView viewMode="orders" />
            </div>
        </div>
    )
}
