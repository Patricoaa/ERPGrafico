"use client"

import { useState } from "react"
import { PaymentHardwareManagement } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export default function TerminalCobroDevicesPage() {
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)

    const createAction = (
        <ToolbarCreateButton label="Nuevo Dispositivo" onClick={() => setIsDeviceModalOpen(true)} />
    )

    return (
        <PaymentHardwareManagement
            activeTab="devices"
            externalDeviceOpen={isDeviceModalOpen}
            onExternalDeviceOpenChange={setIsDeviceModalOpen}
            createAction={createAction}
        />
    )
}
