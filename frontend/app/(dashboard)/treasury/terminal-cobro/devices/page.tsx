import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { PaymentHardwareClientView } from "@/features/treasury"
import { getTerminalCobroSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTerminalCobroSubTab("devices")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Dispositivos de Pago | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function TerminalCobroDevicesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nuevo Dispositivo" href="/treasury/terminal-cobro/devices?modal=device" />

  return (
    <>
      <PaymentHardwareClientView
        activeTab="devices"
        externalDeviceOpen={modal === "device"}
        createAction={createAction}
      />
    </>
  )
}