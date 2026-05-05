import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import Link from "next/link"
import { Receipt, Store } from "lucide-react"
import { Button } from "@/components/ui/button"

const SalesTerminalsView = lazy(() => import("@/features/sales").then(m => ({ default: m.SalesTerminalsView })))

interface PageProps {
    searchParams: Promise<{
        tab?: string,
        modal?: string
    }>
}

export default async function TerminalsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeTab = params.tab || "terminals"
    const modal = params.modal

    const getCreateAction = () => {
        switch (activeTab) {
            case "terminals":
                return <ToolbarCreateButton label="Nuevo Terminal" href="/sales/terminals?tab=terminals&modal=new-terminal" />
            case "batches":
                return <ToolbarCreateButton label="Registrar Liquidación" href="/sales/terminals?tab=batches&modal=new-batch" />
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
