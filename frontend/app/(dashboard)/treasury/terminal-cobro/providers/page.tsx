import type { Metadata } from "next"
import { ToolbarCreateButton } from '@/components/shared'
import { PaymentHardwareManagement } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Proveedores | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TerminalCobroProvidersPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Nuevo Proveedor" href="/treasury/terminal-cobro/providers?modal=provider" />
    )

    return (
        <PaymentHardwareManagement
            activeTab="providers"
            externalProviderOpen={modal === 'provider'}
            createAction={createAction}
        />
    )
}
