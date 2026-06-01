import { ToolbarCreateButton } from "@/components/shared"
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
        <EntriesClientView externalOpen={modal === 'new'} createAction={createAction} />
    )
}
