import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { WorkOrder } from "@/features/production/types"
import WorkOrdersPageClient from "./WorkOrdersPageClient"

const FILTER_PARAMS = new Set(['search', 'status', 'date_from', 'date_to'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function WorkOrdersPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k) || k === 'my_tasks')
    let initialOrders: WorkOrder[] | undefined
    if (!hasActiveFilters) {
        try {
            initialOrders = await serverFetch<WorkOrder[]>('production/orders/', {
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
            <PageSectionHeader title="Órdenes de Producción" description="Planificación y seguimiento de órdenes de fabricación" />
            <WorkOrdersPageClient initialOrders={initialOrders} />
        </>)
}
