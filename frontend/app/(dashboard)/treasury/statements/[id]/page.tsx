import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// T-99 (F9): BankStatement → /treasury/reconciliation?tab=statements&selected=<id>
// StatementsList está montada en la tab "statements" de /treasury/reconciliation.
// NOTA: StatementsList re-navega a /treasury/reconciliation/<id>/workbench al detectar
// el ?selected= — esto es intencional: el workbench es la UI dedicada para statements. (ADR-0020)
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['treasury.bankstatement']
    redirect(`${listUrl}&selected=${id}`)
}
