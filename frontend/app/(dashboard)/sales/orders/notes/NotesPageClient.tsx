"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { SalesOrdersClientView } from "@/features/sales"

export default function NotesPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const legacyId = searchParams.get('id')
    const selectedId = searchParams.get('selected')
    const { openHub, isHubOpen } = useHubPanel()

    const hubEverOpenedRef = useRef(false)

    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/returns/${legacyId}`)
        }
    }, [legacyId, router])

    useEffect(() => {
        if (selectedId) {
            openHub({ orderId: Number(selectedId), type: 'sale' })
        }
    }, [selectedId, openHub])

    useEffect(() => {
        if (isHubOpen && selectedId) hubEverOpenedRef.current = true
    }, [isHubOpen, selectedId])

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
                <SalesOrdersClientView viewMode="notes" />
            </div>
        </div>
    )
}
