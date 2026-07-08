import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): Warehouse → /inventory/stock/warehouses?selected=<id>
// WarehouseList está montada en /inventory/stock/warehouses. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['inventory.warehouse']
    redirect(`${listUrl}&selected=${id}`)
}
