import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string }>
}

export default async function SalesPage({ searchParams }: PageProps) {
    const { view, sub } = await searchParams

    // Redirect logic for backward compatibility with old ?view= params
    if (view === 'orders') redirect(sub === 'notes' ? '/sales/orders?view=notes' : '/sales/orders')
    if (view === 'pos') redirect(sub === 'sessions' ? '/sales/sessions' : '/sales/terminals?tab=terminals')
    if (view === 'hardware') redirect(sub ? `/sales/terminals?tab=${sub}` : '/sales/terminals?tab=batches')
    if (view === 'credits') redirect(sub ? `/sales/credits?tab=${sub}` : '/sales/credits')
    if (view === 'config') redirect('/sales/settings')

    // Default redirect
    redirect('/sales/orders')
}
