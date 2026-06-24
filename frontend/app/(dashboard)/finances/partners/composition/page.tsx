import type { Metadata } from "next"
import { PageHeader, PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { PartnersSettingsView } from "@/features/settings"
import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FINANCES_TABS } from "../../FinancesHeader"

export const metadata: Metadata = {
    title: "Composición Societaria | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function PartnersCompositionPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const navigation = {
        moduleName: "Finanzas",
        moduleHref: "/finances",
        tabs: FINANCES_TABS,
        activeValue: "partners",
        subActiveValue: "composition",
        configHref: "/finances/settings"
    }

    const createAction = (
        <ToolbarCreateButton
            label="Añadir Socio"
            href="/finances/partners/composition?modal=add-partner"
        />
    )

    return (
        <>
            <PageHeader
                title="Composición Societaria"
                description="Gestión de capital suscrito y pagado por los socios."
                iconName="users"
                variant="minimal"
                navigation={navigation}
            >
                <Link href="/finances/partners/composition?modal=stats">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-transparent hover:bg-muted/50 text-muted-foreground/70 hover:text-foreground">
                        <BarChart3 className="h-4 w-4" />
                    </Button>
                </Link>
            </PageHeader>

            <PageSectionHeader title="Composición Societaria" description="Gestión de capital suscrito y pagado por los socios" />

            <PartnersSettingsView
                activeTab="composition"
                initialAddPartnerOpen={modal === 'add-partner'}
                initialStatsOpen={modal === 'stats'}
                createAction={createAction}
            />
        </>
    )
}
