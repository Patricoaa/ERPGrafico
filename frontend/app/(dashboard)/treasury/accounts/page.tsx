import { ToolbarCreateButton } from "@/components/shared"
import { TreasuryAccountsView } from "@/features/treasury"

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function AccountsPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "accounts"
    const modalOpen = modal === "new"

    const actionMap: Record<string, { label: string; href: string }> = {
        accounts: { label: "Nueva Cuenta", href: "/treasury/accounts?tab=accounts&modal=new" },
        banks: { label: "Nuevo Banco", href: "/treasury/accounts?tab=banks&modal=new" },
        methods: { label: "Nuevo Método", href: "/treasury/accounts?tab=methods&modal=new" },
        terminals: { label: "Nueva Caja POS", href: "/treasury/accounts?tab=terminals&modal=new" },
    }

    const action = actionMap[activeTab]
    const createAction = action ? <ToolbarCreateButton label={action.label} href={action.href} /> : null

    return (
        <TreasuryAccountsView activeTab={activeTab} externalOpen={modalOpen} createAction={createAction} />
    )
}
