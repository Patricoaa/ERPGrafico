import { CreditPortfolioView } from "@/features/credits"
import { ToolbarCreateButton } from '@/components/shared'

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function CreditsPortfolioPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Asignar Crédito" href="/sales/credits/portfolio?modal=new" />
    )

    return (
        <CreditPortfolioView
            activeTab="portfolio"
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
