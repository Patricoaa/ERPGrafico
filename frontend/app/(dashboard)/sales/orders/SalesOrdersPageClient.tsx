"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { SalesOrdersClientView } from "@/features/sales"

export default function SalesOrdersPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const legacyId = searchParams.get('id')
    const selectedId = Number(searchParams.get('selected')) || null
    const { openEntity, closeEntity, isSubModalActive } = useGlobalModals()

    // 1. Backward compatibility for legacy ?id=
    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/orders/${legacyId}`)
        }
    }, [legacyId, router])

    // 2. ?selected= abre la ficha documental de la OV en la pila de openEntity (ADR-0020 + ADR-0083):
    //    producto, OT y relacionados se apilan encima con "Volver a OV-…".
    const openedIdRef = useRef<number | null>(null)
    const wasOpenRef = useRef(false)

    useEffect(() => {
        if (!selectedId) {
            // La lista quitó la selección (clic en la fila abierta): se cierra la ficha
            if (openedIdRef.current) {
                openedIdRef.current = null
                closeEntity()
            }
            return
        }
        if (openedIdRef.current === selectedId) return
        openedIdRef.current = selectedId
        wasOpenRef.current = false
        closeEntity()
        openEntity('sales.saleorder', selectedId)
    }, [selectedId, openEntity, closeEntity])

    // 3. Al cerrar la pila se limpia ?selected (solo si la ficha llegó a abrirse)
    useEffect(() => {
        if (isSubModalActive) {
            wasOpenRef.current = true
            return
        }
        if (!wasOpenRef.current || !openedIdRef.current) return
        wasOpenRef.current = false
        openedIdRef.current = null
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [isSubModalActive, searchParams, pathname, router])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                <SalesOrdersClientView viewMode="orders" />
            </div>
        </div>
    )
}
