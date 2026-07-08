import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function FinancesPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams

    if (view === 'statements') redirect(tab ? `/finances/statements/${tab}` : '/finances/statements/bs')
    if (view === 'analysis') redirect(tab ? `/finances/analysis/${tab}` : '/finances/analysis/ratios')
    if (view === 'budgets') redirect(tab ? `/finances/budgets/${tab}` : '/finances/budgets/list')

    redirect('/finances/statements/bs')
}
