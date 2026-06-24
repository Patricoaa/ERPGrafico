import { PageSectionHeader } from "@/components/shared"
import { CreditPortfolioClientView } from "@/features/credits"
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
        <>
            <PageSectionHeader title="Cartera de Créditos" description="Clasificación de deuda por antigüedad y control de deudores" />
            <CreditPortfolioClientView
                activeTab="portfolio"
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
