import { BankPageHeader, BankCenterDashboard } from "@/features/treasury"
import { PageSectionHeader } from "@/components/shared"

const CARD_TABS = [
    { value: "unbilled", label: "Cargos No Facturados" },
    { value: "statements", label: "Cargos Facturados" },
]

export default async function StatementsPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    const id = Number(bankId)
    return (
        <div className="h-full flex flex-col">
            <BankPageHeader bankId={id} />
            <PageSectionHeader
                title="Tarjeta de crédito"
                tabs={CARD_TABS}
                basePath={`/treasury/bank-center/${id}/cards`}
            />
            <BankCenterDashboard bankId={id} subtab="statements" />
        </div>
    )
}
