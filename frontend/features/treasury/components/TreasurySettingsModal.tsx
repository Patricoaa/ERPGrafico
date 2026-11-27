"use client"

import { useState } from "react"
import { Settings, Terminal } from "lucide-react"
import { BaseModal, DrawerLayout, RailNav, type RailNavSection } from "@/components/shared"
import { TreasurySettingsView } from "@/features/settings"

interface TreasurySettingsModalProps {
    open?: boolean
    onOpenChange: (open: boolean) => void
    initialSection?: string
}

const sections: RailNavSection[] = [
    {
        label: "Tesorería",
        items: [
            { label: "Terminal de Cobro", value: "terminal-cobro", icon: Terminal },
        ],
    },
]

export function TreasurySettingsModal({
    open = true,
    onOpenChange,
    initialSection = "terminal-cobro",
}: TreasurySettingsModalProps) {
    const [activeSection, setActiveSection] = useState(initialSection)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Configuración de Tesorería"
            description="Terminal de cobro y sincronización de terminales POS"
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
                        ariaLabel="Secciones de configuración de tesorería"
                    />
                }
                leftRailWidth="w-14 sm:w-56"
                noPadding
                contentClassName="p-4 sm:p-8 overflow-y-auto custom-scrollbar"
            >
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {activeSection === "terminal-cobro" && <TreasurySettingsView />}
                </div>
            </DrawerLayout>
        </BaseModal>
    )
}
