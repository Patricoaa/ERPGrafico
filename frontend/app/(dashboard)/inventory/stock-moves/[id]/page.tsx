import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): StockMove → /inventory/stock?tab=movements&selected=<id>
// MovementList está montada en la tab "movements" de /inventory/stock. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['inventory.stockmove']
    redirect(`${listUrl}&selected=${id}`)
}
