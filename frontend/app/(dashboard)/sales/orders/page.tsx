import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { SaleOrder } from "@/features/sales"
import SalesOrdersPageClient from "./SalesOrdersPageClient"

const FILTER_PARAMS = new Set(['customer_name', 'status', 'date_after', 'date_before'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function SalesOrdersPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialOrders: SaleOrder[] | undefined
    if (!hasActiveFilters) {
        try {
            initialOrders = await serverFetch<SaleOrder[]>('sales/orders/', {
                params: {
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
            <PageSectionHeader title="Órdenes de Venta" description="Gestión de pedidos y cotizaciones de clientes" />
            <SalesOrdersPageClient initialOrders={initialOrders} />
        </>)
}
