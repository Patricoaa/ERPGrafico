import { ToolbarCreateButton } from '@/components/shared'
import { SalesPosLayout } from "@/features/sales"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function PosCajasPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Caja" href="/sales/pos/cajas?modal=new-terminal" />

    return (
        <SalesPosLayout
            activeTab="cajas"
            modal={modal}
            createAction={createAction}
        />
    )
}