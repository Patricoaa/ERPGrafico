import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { PurchaseOrderAPI } from "@/features/purchasing"
import type { Invoice } from "@/features/billing"
import PurchasingPageClient from "./PurchasingPageClient"

const FILTER_PARAMS = new Set(['search', 'status', 'date_from', 'date_to'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialOrders: PurchaseOrderAPI[] | undefined
    let initialNotes: Invoice[] | undefined

    if (!hasActiveFilters) {
        try {
            initialOrders = await serverFetch<PurchaseOrderAPI[]>('purchasing/orders/', {
                params: { page_size: '200' },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }

        try {
            initialNotes = await serverFetch<Invoice[]>('billing/invoices/', {
                params: {
                    dte_type__in: 'NOTA_CREDITO,NOTA_DEBITO',
                    purchase_order__isnull: 'false',
                    page_size: '50',
                },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Órdenes de Compra" description="Gestión de solicitudes y órdenes de compra a proveedores" />
            <PurchasingPageClient initialOrders={initialOrders} initialNotes={initialNotes} />
        </>)
}
