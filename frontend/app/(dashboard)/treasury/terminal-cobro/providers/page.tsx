import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { PaymentHardwareClientView } from "@/features/treasury"

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
        <>
            <PageSectionHeader title="Proveedores" description="Administración de proveedores de servicios de pago" />
            <PaymentHardwareClientView
                activeTab="providers"
                externalProviderOpen={modal === 'provider'}
                createAction={createAction}
            />
        </>)
}
