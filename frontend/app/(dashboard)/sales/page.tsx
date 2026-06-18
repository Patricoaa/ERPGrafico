import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string }>
}

export default async function SalesPage({ searchParams }: PageProps) {
    const { view, sub } = await searchParams

    if (view === 'orders') redirect(sub === 'notes' ? '/sales/orders/notes' : '/sales/orders')
    if (view === 'pos') redirect(sub === 'sessions' ? '/sales/sessions' : '/sales/pos/cajas')
    if (view === 'hardware') redirect(sub ? `/treasury/terminal-cobro/${sub}` : '/treasury/terminal-cobro/providers')
    if (view === 'credits') redirect(sub ? `/sales/credits/${sub}` : '/sales/credits/portfolio')
    if (view === 'config') redirect('/sales/settings/credit')

    redirect('/sales/orders')
}
