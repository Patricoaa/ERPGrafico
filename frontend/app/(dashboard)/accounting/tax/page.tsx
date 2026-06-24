import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import { TaxDeclarationsClientView } from "@/features/tax"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TaxPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nueva Declaración" 
            href="/accounting/tax?modal=new" 
        />
    )

    return (
        <>
            <PageSectionHeader title="Declaraciones Tributarias" description="Declaraciones de impuestos y formularios" />
            <TaxDeclarationsClientView externalOpen={modal === 'new'} createAction={createAction} />
        </>)
}
