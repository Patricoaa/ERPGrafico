import { lazy, Suspense } from "react"
import { LoadingFallback, PageHeader, ToolbarCreateButton, TableSkeleton } from "@/components/shared"
import { LAYOUT_TOKENS } from "@/lib/styles"

const TreasuryAccountsView = lazy(() =>
    import("@/features/treasury").then(module => ({
        default: module.TreasuryAccountsView
    }))
)

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function AccountsPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "accounts"
    const modalOpen = modal === "new"

    const tabs = [
        { value: "accounts", label: "Cuentas", iconName: "list", href: "/treasury/accounts?tab=accounts" },
        { value: "banks", label: "Bancos", iconName: "landmark", href: "/treasury/accounts?tab=banks" },
        { value: "methods", label: "Métodos", iconName: "credit-card", href: "/treasury/accounts?tab=methods" },
    ]

    const navigation = {
        tabs,
        activeValue: activeTab
    }

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "accounts":
                return {
                    title: "Cuentas de Tesorería",
                    description: "Registre y configure sus cuentas bancarias y de efectivo.",
                    iconName: "landmark",
                    actionLabel: "Nueva Cuenta",
                    actionHref: "/treasury/accounts?tab=accounts&modal=new"
                }
            case "banks":
                return {
                    title: "Gestión de Bancos",
                    description: "Administre las entidades bancarias globales del sistema.",
                    iconName: "building-2",
                    actionLabel: "Nuevo Banco",
                    actionHref: "/treasury/accounts?tab=banks&modal=new"
                }
            case "methods":
                return {
                    title: "Métodos de Pago",
                    description: "Configure los medios de pago aceptados y sus cuentas vinculadas.",
                    iconName: "credit-card",
                    actionLabel: "Nuevo Método",
                    actionHref: "/treasury/accounts?tab=methods&modal=new"
                }
            default:
                return { title: "Tesorería", description: "", iconName: "banknote", actionLabel: null, actionHref: null }
        }
    }

    const { title, description, iconName, actionLabel, actionHref } = getHeaderConfig()

    const createAction = actionLabel && actionHref ? (
        <ToolbarCreateButton label={actionLabel} href={actionHref} />
    ) : null

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                iconName={iconName}
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    <TreasuryAccountsView activeTab={activeTab} externalOpen={modalOpen} createAction={createAction} />
                </Suspense>
            </div>
        </div>
    )
}

