import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { Invoice } from "@/features/billing"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"

const FILTER_PARAMS = new Set(['search', 'status', 'dte_type', 'date_from', 'date_to', 'partner_name'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function SalesInvoicesPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialInvoices: Invoice[] | undefined
    if (!hasActiveFilters) {
        try {
            initialInvoices = await serverFetch<Invoice[]>('billing/invoices/', {
                params: {
                    sale_order__isnull: 'false',
                    page_size: '200',
                },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Facturas de Venta" description="Documentos tributarios electrónicos de venta" />
            <SalesInvoicesPageClient initialInvoices={initialInvoices} />
        </>)
}
