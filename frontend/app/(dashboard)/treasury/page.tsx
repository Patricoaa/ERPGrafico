import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; sub?: string; tab?: string }>
}

export default async function TreasuryPage({ searchParams }: PageProps) {
    const { view, sub, tab } = await searchParams

    if (view === 'accounts') redirect(sub ? `/treasury/operaciones?tab=${sub}` : '/treasury/operaciones?tab=accounts')
    if (view === 'reconciliation') redirect(sub ? `/treasury/reconciliation?tab=${sub}` : '/treasury/reconciliation')
    if (view === 'config') redirect(tab ? `/treasury/settings?tab=${tab}` : '/treasury/settings')
    if (view === 'movements') redirect('/treasury/operaciones?tab=movements')

    redirect('/treasury/operaciones?tab=movements')
}
