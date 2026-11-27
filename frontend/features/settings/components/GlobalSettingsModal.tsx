"use client"

import { useState } from "react"
import { Settings } from "lucide-react"
import { BaseModal, DrawerLayout } from "@/components/shared"
import { CompanySettingsView } from "./CompanySettingsView"
import { UnifiedAccountsView } from "./UnifiedAccountsView"
import { WorkflowSettings } from "@/features/workflow"
import { GlobalSettingsSidebar } from "./GlobalSettingsSidebar"

interface GlobalSettingsModalProps {
    open?: boolean
    onOpenChange: (open: boolean) => void
    initialSection?: string
}

export function GlobalSettingsModal({
    open = true,
    onOpenChange,
    initialSection = "company_general",
}: GlobalSettingsModalProps) {
    const [activeSection, setActiveSection] = useState(initialSection)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Configuración Global"
            description="Parámetros transversales y organización de la empresa"
            icon={<Settings className="h-6 w-6 text-primary" />}
            size="full"
            variant="raw"
            hideScrollArea
            className="w-[calc(100vw-1rem)] max-w-[1600px] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] rounded-md p-0 gap-0"
            contentClassName="p-0 overflow-hidden"
            headerClassName="border-b border-border/70 px-4 py-3 sm:px-6"
            titleClassName="text-base font-semibold tracking-tight"
        >
            <DrawerLayout
                leftRail={
                    <GlobalSettingsSidebar
                        activeSection={activeSection}
                        onSectionChange={setActiveSection}
                    />
                }
                leftRailWidth="w-14 sm:w-60"
                noPadding
                contentClassName="p-4 sm:p-8 overflow-y-auto custom-scrollbar"
            >
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {activeSection === "company_general" && (
                        <CompanySettingsView activeTab="general" />
                    )}
                    {activeSection === "company_branding" && (
                        <CompanySettingsView activeTab="branding" />
                    )}
                    {activeSection.startsWith("accounts_") && (
                        <UnifiedAccountsView activeTab={activeSection.replace("accounts_", "")} />
                    )}
                    {activeSection.startsWith("workflow_") && (
                        <WorkflowSettings
                            activeTab={activeSection.replace("workflow_", "") as "approvals" | "tasks" | "notifications" | "policies"}
                        />
                    )}
                </div>
            </DrawerLayout>
        </BaseModal>
    )
}
