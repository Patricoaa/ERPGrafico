"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SalesOrdersClientView } from "@/features/sales"

export default function NotesPageClient() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const legacyId = searchParams.get('id')

    useEffect(() => {
        if (legacyId) {
            router.replace(`/sales/returns/${legacyId}`)
        }
    }, [legacyId, router])

    if (legacyId) {
        return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>
    }

    // ?selected= abre la ficha documental de la nota desde la propia lista (useDocumentSheetRoute).
    // Antes abría el Hub con el id de la nota como si fuera una OV.
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col">
                <SalesOrdersClientView viewMode="notes" />
            </div>
        </div>
    )
}
