import type { Metadata } from "next"
import { PageHeader, ToolbarCreateButton } from '@/components/shared'
import { PartnersSettingsView } from "@/features/settings"
import { FINANCES_TABS } from "../../FinancesHeader"

export const metadata: Metadata = {
    title: "Distribución de Utilidades | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function PartnersDistributionsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const navigation = {
        moduleName: "Finanzas",
        moduleHref: "/finances",
        tabs: FINANCES_TABS,
        activeValue: "partners",
        subActiveValue: "distributions",
        configHref: "/finances/settings"
    }

    const createAction = (
        <ToolbarCreateButton
            label="Nueva Distribución"
            href="/finances/partners/distributions?modal=new-distribution"
        />
    )

    return (
        <div className="h-full flex flex-col">
            <PageHeader
                title="Distribución de Utilidades"
                description="Gestión de actas, resolución de dividendos y reinversiones."
                iconName="pie-chart"
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4 flex-1 min-h-0 flex flex-col">
                <PartnersSettingsView
                    activeTab="distributions"
                    initialFlowOpen={modal === 'new-distribution'}
                    createAction={createAction}
                />
            </div>
        </div>
    )
}
