"use client"

import { useState } from "react"
import { Settings, Percent, FileText } from "lucide-react"
import { BaseModal, DrawerLayout, RailNav, type RailNavSection } from "@/components/shared"
import { VatRatesView, RcvSettingsView } from "@/features/settings"

interface AccountingSettingsModalProps {
    open?: boolean
    onOpenChange: (open: boolean) => void
    initialSection?: string
}

const sections: RailNavSection[] = [
    {
        label: "Contabilidad",
        items: [
            { label: "Tasas IVA", value: "vat-rates", icon: Percent },
            { label: "RCV / SII", value: "rcv", icon: FileText },
        ],
    },
]

export function AccountingSettingsModal({
    open = true,
    onOpenChange,
    initialSection = "vat-rates",
}: AccountingSettingsModalProps) {
    const [activeSection, setActiveSection] = useState(initialSection)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Configuración de Contabilidad"
            description="Tasas de IVA, RCV y parámetros del SII"
            icon={<Settings className="h-6 w-6 text-primary" />}
            size="full"
            variant="raw"
            hideScrollArea
            className="w-[calc(100vw-1rem)] max-w-[1200px] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] rounded-md p-0 gap-0"
            contentClassName="p-0 overflow-hidden"
            headerClassName="border-b border-border/70 px-4 py-3 sm:px-6"
            titleClassName="text-base font-semibold tracking-tight"
        >
            <DrawerLayout
                leftRail={
                    <RailNav
                        sections={sections}
                        value={activeSection}
                        onValueChange={setActiveSection}
                        ariaLabel="Secciones de configuración de contabilidad"
                    />
                }
                leftRailWidth="w-14 sm:w-56"
                noPadding
                contentClassName="p-4 sm:p-8 overflow-y-auto custom-scrollbar"
            >
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {activeSection === "vat-rates" && <VatRatesView />}
                    {activeSection === "rcv" && <RcvSettingsView />}
                </div>
            </DrawerLayout>
        </BaseModal>
    )
}
