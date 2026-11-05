import { redirect } from 'next/navigation'
import { searchableEntityRoutes } from '@/lib/searchableEntityRoutes'

// BankStatement → /treasury/reconciliation?selected=<id>
// StatementsClientView abre la ficha de la cartola como pestaña del espacio de trabajo
// (openEntity). La mesa de conciliación es otra pestaña (openWorkbench, ?workbench=<id>).
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const listUrl = searchableEntityRoutes['treasury.bankstatement']
    redirect(`${listUrl}?selected=${id}`)
}
