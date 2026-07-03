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
            const ordersResponse = await serverFetch<{ results: PurchaseOrderAPI[] }>('purchasing/orders/', {
                params: { page_size: '200' },
                revalidate: 10,
            })
            initialOrders = ordersResponse.results
        } catch (e: any) {
            if (e?.status !== 401) {
                console.warn('[PurchasingPage] serverFetch orders failed, client will refetch:', e)
            }
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
        } catch (e: any) {
            if (e?.status !== 401) {
                console.warn('[PurchasingPage] serverFetch notes failed, client will refetch:', e)
            }
        }
    }

    return (
        <>
            <PageSectionHeader title="Órdenes de Compra" description="Gestión de solicitudes y órdenes de compra a proveedores" />
            <PurchasingPageClient initialOrders={initialOrders} initialNotes={initialNotes} />
        </>)
}
