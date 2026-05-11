import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): POSSession → /sales/sessions?selected=<id>
// POSSessionsView está montada en /sales/sessions. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['treasury.possession']
    redirect(`${listUrl}?selected=${id}`)
}
