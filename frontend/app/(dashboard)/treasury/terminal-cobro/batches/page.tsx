import type { Metadata } from "next"
import { ToolbarCreateButton } from '@/components/shared'
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
            <TerminalBatchesClientView

                createAction={createAction}
            />
        </>)
}
