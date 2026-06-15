"use client"

import { useState } from "react"
import { PaymentHardwareManagement } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export default function TerminalCobroProvidersPage() {
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)

    const createAction = (
        <ToolbarCreateButton label="Nuevo Proveedor" onClick={() => setIsProviderModalOpen(true)} />
    )

    return (
        <PaymentHardwareManagement
            activeTab="providers"
            externalProviderOpen={isProviderModalOpen}
            onExternalProviderOpenChange={setIsProviderModalOpen}
            createAction={createAction}
        />
    )
}
