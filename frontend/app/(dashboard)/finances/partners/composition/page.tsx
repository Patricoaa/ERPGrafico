"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { PageHeader, ToolbarCreateButton } from '@/components/shared'
import { useSearchParams, useRouter } from "next/navigation"
import { PartnersSettingsView } from "@/features/settings"
import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FINANCES_TABS } from "../../FinancesHeader"

export default function PartnersCompositionPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const isAddPartnerModal = searchParams.get("modal") === "add-partner"
    const isStatsModal = searchParams.get("modal") === "stats"
    const [saving, setSaving] = useState(false)

    const prevSaving = useRef(false)

    const handleModalClose = useCallback(() => {
        const currentModal = searchParams.get("modal")
        if (currentModal === "add-partner" || currentModal === "stats") {
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
        subActiveValue: "composition",
        configHref: "/finances/settings"
    }

    const createAction = (
        <ToolbarCreateButton
            label="Añadir Socio"
            href="/finances/partners/composition?modal=add-partner"
        />
    )

    return (
        <div className="h-full flex flex-col">
            <PageHeader
                title="Composición Societaria"
                description="Gestión de capital suscrito y pagado por los socios."
                iconName="users"
                variant="minimal"
                navigation={navigation}
            >
                <Link href="/finances/partners/composition?modal=stats">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-transparent hover:bg-muted/50 text-muted-foreground/70 hover:text-foreground">
                        <BarChart3 className="h-4 w-4" />
                    </Button>
                </Link>
            </PageHeader>

            <div className="pt-4 flex-1 min-h-0 flex flex-col">
                <PartnersSettingsView
                    activeTab="composition"
                    onSavingChange={setSaving}
                    initialAddPartnerOpen={isAddPartnerModal}
                    initialStatsOpen={isStatsModal}
                    onModalClose={handleModalClose}
                    createAction={createAction}
                />
            </div>
        </div>
    )
}
