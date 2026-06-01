import { redirect } from "next/navigation"
import { ToolbarCreateButton } from '@/components/shared'
import { SalesPosView } from "@/features/sales"

interface PageProps {
    searchParams: Promise<{
        tab?: string,
        modal?: string
    }>
}

export default async function PosPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "cajas"
    const modal = params.modal

    if (!params.tab) {
        redirect('/sales/pos?tab=cajas')
    }

    const getCreateAction = () => {
        switch (activeTab) {
            case "cajas":
                return <ToolbarCreateButton label="Nueva Caja" href="/sales/pos?tab=cajas&modal=new-terminal" />
            default:
                return null
        }
    }

    return (
        <SalesPosView
            activeTab={activeTab}
            modal={modal}
            createAction={getCreateAction()}
        />
    )
}
