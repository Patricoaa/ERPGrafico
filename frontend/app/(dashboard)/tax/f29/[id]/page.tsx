import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): F29Declaration → /accounting/tax?selected=<id>
// TaxDeclarationsView está montada en /accounting/tax, no en /tax/f29. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['tax.f29declaration']
    redirect(`${listUrl}?selected=${id}`)
}
