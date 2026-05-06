import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function AccountingPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams

    // Redirect logic for backward compatibility with old ?view= params
    if (view === 'ledger') redirect('/accounting/ledger')
    if (view === 'entries') redirect('/accounting/entries')
    if (view === 'closures') redirect('/accounting/closures')
    if (view === 'tax') redirect('/accounting/tax')
    if (view === 'config') redirect(tab ? `/accounting/settings?tab=${tab}` : '/accounting/settings')

    // Default redirect
    redirect('/accounting/ledger')
}
