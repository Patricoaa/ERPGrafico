import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import EntriesClientView from "./EntriesClientView"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function EntriesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nuevo Asiento" 
            href="/accounting/entries?modal=new" 
        />
    )

    return (
        <>
            <PageSectionHeader title="Asientos Contables" description="Registro de transacciones contables" />
            <EntriesClientView externalOpen={modal === 'new'} createAction={createAction} />
        </>)
}
