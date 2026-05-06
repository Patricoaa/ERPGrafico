import { redirect } from "next/navigation"

interface PageProps {
    searchParams: Promise<{ view?: string; tab?: string }>
}

export default async function FinancesPage({ searchParams }: PageProps) {
    const { view, tab } = await searchParams

    // Redirect logic for backward compatibility with old ?view= params
    if (view === 'statements') redirect(tab ? `/finances/statements?tab=${tab}` : '/finances/statements')
    if (view === 'analysis') redirect(tab ? `/finances/analysis?tab=${tab}` : '/finances/analysis')
    if (view === 'budgets') redirect(tab ? `/finances/budgets?tab=${tab}` : '/finances/budgets')

    // Default redirect
    redirect('/finances/statements')
}
