import { serverFetch } from "@/lib/server-fetch"
import type { Invoice } from "@/features/billing"
import PurchasesPageClient from "./PurchasesPageClient"

const FILTER_PARAMS = new Set(['partner_name', 'status', 'dte_type', 'date_from', 'date_to'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function PurchasesPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialInvoices: Invoice[] | undefined
    if (!hasActiveFilters) {
        try {
            initialInvoices = await serverFetch<Invoice[]>('billing/invoices/', {
                params: {
                    page_size: '200',
                    purchase_order__isnull: 'false',
                },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return <PurchasesPageClient initialInvoices={initialInvoices} />
}
