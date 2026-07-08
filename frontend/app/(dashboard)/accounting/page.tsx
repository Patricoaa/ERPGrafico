import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function AccountingPage({ searchParams }: PageProps) {
    const { view } = await searchParams

    if (view === 'ledger') redirect('/accounting/ledger')
    if (view === 'entries') redirect('/accounting/entries')
    if (view === 'closures') redirect('/accounting/closures')
    if (view === 'tax') redirect('/accounting/tax')

    redirect('/accounting/ledger')
}
