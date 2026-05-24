import { ToolbarCreateButton } from "@/components/shared"
import { TaxDeclarationsView } from "@/features/tax"

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
        <TaxDeclarationsView externalOpen={modal === 'new'} createAction={createAction} />
    )
}
