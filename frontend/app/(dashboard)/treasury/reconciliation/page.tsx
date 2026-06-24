import { type Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton, FadeIn } from "@/components/shared"
import { StatementsList } from "@/features/finance"

export const metadata: Metadata = {
    title: "Conciliación Bancaria | ERPGrafico",
    description: "Gestión de cartolas y cuadratura de movimientos bancarios.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const modalOpen = resolvedParams.modal === "import"

    const createAction = (
        <ToolbarCreateButton
            label="Importar Cartola"
            iconName="upload"
            href="/treasury/reconciliation?modal=import"
        />
    )

    return (
        <>
            <PageSectionHeader title="Conciliación Bancaria" description="Gestión de cartolas y cuadratura de movimientos" />
            <FadeIn>
                <StatementsList externalOpen={modalOpen} createAction={createAction} />
            </FadeIn>
        </>)
}
