import type { Metadata } from "next"
import { ToolbarCreateButton } from '@/components/shared'
import { TerminalBatchesClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Liquidaciones | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TerminalCobroBatchesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Registrar Liquidación" href="/treasury/terminal-cobro/batches?modal=batch" />
    )

    return (
        <TerminalBatchesClientView
            showTitle={false}
            externalOpenBatch={modal === 'batch'}
            externalOpenInvoice={modal === 'invoice'}
            createAction={createAction}
        />
    )
}
