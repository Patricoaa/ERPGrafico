"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { SalesOrdersClientView } from "@/features/sales"
import { OrderSheet } from "@/features/orders"

export default function SalesOrdersPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const legacyId = searchParams.get('id')
    const selectedId = Number(searchParams.get('selected')) || null

    // 1. Backward compatibility for legacy ?id=
    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/orders/${legacyId}`)
        }
    }, [legacyId, router])

    // 2. ?selected= abre la ficha documental de la OV (ADR-0020 + ADR-0083); cerrar limpia la URL.
    const closeSheet = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                <SalesOrdersClientView viewMode="orders" />
            </div>
            {selectedId && (
                <OrderSheet
                    key={selectedId}
                    id={selectedId}
                    kind="sale"
                    open
                    onOpenChange={(open) => { if (!open) closeSheet() }}
                />
            )}
        </div>
    )
}
