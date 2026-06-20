import { Metadata } from "next"
import { CreditPortfolioClientView } from "@/features/credits"
import { ToolbarCreateButton } from '@/components/shared'

export const metadata: Metadata = {
    title: "Cartera de Créditos | ERPGrafico",
    description: "Gestión de cartera crediticia, clasificación de deuda por antigüedad y control de deudores.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function CreditsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Asignar Crédito" href="/sales/credits/portfolio?modal=new" />
    )

    return (
        <CreditPortfolioClientView
            activeTab="portfolio"
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
