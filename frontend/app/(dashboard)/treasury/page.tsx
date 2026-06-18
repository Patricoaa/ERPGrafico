import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; tab?: string }>
}

export default async function TreasuryPage({ searchParams }: PageProps) {
    const { view, sub, tab } = await searchParams

    if (view === 'accounts') redirect(sub ? `/treasury/operaciones/${sub}` : '/treasury/operaciones/accounts')
    if (view === 'reconciliation') redirect('/treasury/reconciliation')
    if (view === 'movements') redirect('/treasury/operaciones/movements')

    redirect('/treasury/operaciones/movements')
}
