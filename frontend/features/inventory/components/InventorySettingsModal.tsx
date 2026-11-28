"use client"

import { useState } from "react"
import { Settings, Scale } from "lucide-react"
import { BaseModal, DrawerLayout, RailNav, type RailNavSection } from "@/components/shared"
import dynamic from "next/dynamic"

const InventorySettingsPageClient = dynamic(
    () => import("@/app/(dashboard)/inventory/settings/InventorySettingsPageClient"),
    { ssr: false },
)

interface InventorySettingsModalProps {
    open?: boolean
    onOpenChange: (open: boolean) => void
    initialSection?: string
}

const sections: RailNavSection[] = [
    {
        label: "Inventario",
        items: [
            { label: "Valorización", value: "valuation", icon: Scale },
        ],
    },
]

export function InventorySettingsModal({
    open = true,
    onOpenChange,
    initialSection = "valuation",
}: InventorySettingsModalProps) {
    const [activeSection, setActiveSection] = useState(initialSection)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Configuración de Inventario"
            description="Método de valorización y parámetros de costos"
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
                        ariaLabel="Secciones de configuración de inventario"
                    />
                }
                leftRailWidth="w-14 sm:w-56"
                noPadding
                contentClassName="p-4 sm:p-8 overflow-y-auto custom-scrollbar"
            >
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {activeSection === "valuation" && (
                        <InventorySettingsPageClient />
                    )}
                </div>
            </DrawerLayout>
        </BaseModal>
    )
}
