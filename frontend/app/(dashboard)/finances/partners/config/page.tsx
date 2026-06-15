"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { PageHeader } from '@/components/shared'
import { PartnerAccountingTab } from "@/features/settings"
import { FINANCES_TABS } from "../../FinancesHeader"

export default function PartnersConfigPage() {
    const [configSaving, setConfigSaving] = useState(false)
    const prevConfigSaving = useRef(false)

    useEffect(() => {
        if (prevConfigSaving.current && !configSaving) {
            toast.success("Arquitectura contable actualizada", {
                description: "Los cambios en las cuentas maestras se han guardado."
            })
        }
        prevConfigSaving.current = configSaving
    }, [configSaving])

    const navigation = {
        moduleName: "Finanzas",
        moduleHref: "/finances",
        tabs: FINANCES_TABS,
        activeValue: "partners",
        subActiveValue: "config",
        configHref: "/finances/settings"
    }

    return (
        <div className="h-full flex flex-col">
            <PageHeader
                title="Arquitectura Contable de Socios"
                description="Configure las cuentas maestras para el Modelo Híbrido de Capital."
                iconName="settings"
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4 flex-1 min-h-0 flex flex-col">
                <div className="p-1">
                    <PartnerAccountingTab onSavingChange={setConfigSaving} />
                </div>
            </div>
        </div>
    )
}
