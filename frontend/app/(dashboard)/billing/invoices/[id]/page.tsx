"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { use } from "react"

interface PageProps {
    params: Promise<{ id: string }>
}

export default function InvoiceRouterClient({ params }: PageProps) {
    const { id } = use(params)
    const router = useRouter()

    useEffect(() => {
        // Quick fetch to get metadata to route correctly
        api.get(`/billing/invoices/${id}/`)
            .then(res => {
                const isSale = res.data.is_sale_document
                if (isSale) {
                    router.replace(`/billing/sales/${id}`)
                } else {
                    router.replace(`/billing/purchases/${id}`)
                }
            })
            .catch(err => {
                console.error("Error fetching invoice for routing:", err)
                // Fallback to sales if we can't determine or it's a 404
                router.replace(`/billing/sales/${id}`)
            })
    }, [id, router])

    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p>Redirigiendo documento...</p>
            </div>
        </div>
    )
}
