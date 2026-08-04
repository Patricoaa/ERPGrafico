import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { TerminalBatchesClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Liquidaciones | ERPGrafico",
}

export default async function TerminalCobroBatchesPage() {
    const createAction = (
        <ToolbarCreateButton label="Registrar Liquidación" href="/treasury/terminal-cobro/batches?modal=batch" />
    )

    return (
        <>
            <PageSectionHeader title="Liquidaciones" description="Gestión de liquidaciones y cierres de lote" />
            <TerminalBatchesClientView

                createAction={createAction}
            />
        </>)
}
