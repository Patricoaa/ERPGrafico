import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { AccountsClientView } from "@/features/accounting"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = (
        <ToolbarCreateButton 
            label="Nueva Cuenta" 
            href="/accounting/ledger?modal=new" 
        />
    )

    return (
        <AccountsClientView externalOpen={modal === 'new'} createAction={createAction} />
    )
}
