import { lazy, Suspense } from "react"
import { redirect } from "next/navigation"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"



const SalesTerminalsView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesTerminalsView })))

interface PageProps {
    searchParams: Promise<{
        tab?: string,
        modal?: string
    }>
}

export default async function TerminalsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "pos-terminals"
    const modal = params.modal

    if (!params.tab) {
        redirect('/sales/terminals?tab=pos-terminals')
    }

    const getCreateAction = () => {
        switch (activeTab) {
            case "pos-terminals":
                return <ToolbarCreateButton label="Nuevo Terminal" href="/sales/terminals?tab=pos-terminals&modal=new-terminal" />
            case "batches":
                return <ToolbarCreateButton label="Registrar Liquidación" href="/sales/terminals?tab=batches&modal=new-batch" />
            case "devices":
                return <ToolbarCreateButton label="Nuevo Dispositivo" href="/sales/terminals?tab=devices&modal=new-device" />
            case "providers":
                return <ToolbarCreateButton label="Nuevo Proveedor" href="/sales/terminals?tab=providers&modal=new-provider" />
            default:
                return null
        }
    }

    return (
        <div className="pt-2">
            <Suspense fallback={<LoadingFallback message="Cargando terminales..." />}>
                <SalesTerminalsView
                    activeTab={activeTab}
                    modal={modal}
                    createAction={getCreateAction()}
                />
            </Suspense>
        </div>
    )
}
