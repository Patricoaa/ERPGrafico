"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { PageHeader, ToolbarCreateButton } from '@/components/shared'
import { useSearchParams, useRouter } from "next/navigation"
import { PartnersSettingsView } from "@/features/settings"
import { FINANCES_TABS } from "../../FinancesHeader"

export default function PartnersDistributionsPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewDistributionModal = searchParams.get("modal") === "new-distribution"
    const [saving, setSaving] = useState(false)

    const prevSaving = useRef(false)

    const handleModalClose = useCallback(() => {
        const currentModal = searchParams.get("modal")
        if (currentModal === "new-distribution" || currentModal === "mobilize-earnings") {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }, [searchParams, router])

    useEffect(() => {
        if (prevSaving.current && !saving) {
            toast.success("Cambios sincronizados", {
                description: "La configuración de socios ha sido actualizada."
            })
        }
        prevSaving.current = saving
    }, [saving])

    const navigation = {
        moduleName: "Finanzas",
        moduleHref: "/finances",
        tabs: FINANCES_TABS,
        activeValue: "partners",
        subActiveValue: "distributions",
        configHref: "/finances/settings"
    }

    const createAction = (
        <ToolbarCreateButton
            label="Nueva Distribución"
            href="/finances/partners/distributions?modal=new-distribution"
        />
    )

    return (
        <div className="h-full flex flex-col">
            <PageHeader
                title="Distribución de Utilidades"
                description="Gestión de actas, resolución de dividendos y reinversiones."
                iconName="pie-chart"
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4 flex-1 min-h-0 flex flex-col">
                <PartnersSettingsView
                    activeTab="distributions"
                    onSavingChange={setSaving}
                    initialFlowOpen={isNewDistributionModal}
                    onModalClose={handleModalClose}
                    createAction={createAction}
                />
            </div>
        </div>
    )
}
