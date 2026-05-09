import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-88: BankStatement → /treasury/statements?selected=<id>
// Opción A (ADR-0020): redirige a la lista con ?selected=<id>
// El modal de edición se abre en la lista con initialData fetcheado por useSelectedEntity.
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['treasury.bankstatement']
    redirect(`${listUrl}?selected=${id}`)
}
