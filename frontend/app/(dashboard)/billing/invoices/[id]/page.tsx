"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { useInvoice } from '@/features/billing'

interface PageProps {
    params: Promise<{ id: string }>
}

export default function InvoiceRouterClient({ params }: PageProps) {
    const { id } = use(params)
    const router = useRouter()
    const { data: invoice, isLoading } = useInvoice(Number(id))

    useEffect(() => {
        if (!isLoading && invoice) {
            if (invoice.is_sale_document) {
                router.replace(`/billing/sales/${id}`)
            } else {
                router.replace(`/billing/purchases/${id}`)
            }
        }
    }, [id, router, invoice, isLoading])

    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p>Redirigiendo documento...</p>
            </div>
        </div>
    )
}
