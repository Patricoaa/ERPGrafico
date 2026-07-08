import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { PaymentHardwareClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Dispositivos | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TerminalCobroDevicesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = (
        <ToolbarCreateButton label="Nuevo Dispositivo" href="/treasury/terminal-cobro/devices?modal=device" />
    )

    return (
        <>
            <PageSectionHeader title="Dispositivos" description="Administración de terminales de pago y hardware POS" />
            <PaymentHardwareClientView
                activeTab="devices"
                externalDeviceOpen={modal === 'device'}
                createAction={createAction}
            />
        </>)
}
