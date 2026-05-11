import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): Account → /accounting/ledger?selected=<id>
// AccountsClientView está montada en /accounting/ledger, no en /accounting/accounts.
// El [id] redirect apunta ahora a la vista real donde vive el modal. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['accounting.account']
    redirect(`${listUrl}?selected=${id}`)
}
