"use client"

import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useRouter, useSearchParams } from "next/navigation"

const ContactsClientView = lazy(() =>
    import("@/features/contacts").then(m => ({ default: m.ContactsClientView }))
)
const PartnersSettingsView = lazy(() => import("@/features/settings").then(m => ({ default: m.PartnersSettingsView })))
import { SettingsSheetRouteWrapper } from "@/components/shared"
import { Settings2 } from "lucide-react"

export default function ContactsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isNewModalOpen = searchParams.get("modal") === "new"
    const activeTab = searchParams.get("tab") || "composition"

    const handleOpenNew = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("modal", "new")
        router.push(`?${params.toString()}`)
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Contactos"
                description="Directorio centralizado de clientes, proveedores y colaboradores."
                titleActions={
                    <PageHeaderButton
                        onClick={handleOpenNew}
                        iconName="plus"
                        circular
                        title="Nuevo Contacto"
                    />
                }
                configHref="?config=true"
                iconName="users-2"
            />

            <Suspense fallback={<LoadingFallback />}>
                <ContactsClientView isNewModalOpen={isNewModalOpen} />
            </Suspense>

            <SettingsSheetRouteWrapper
                sheetId="partners-settings"
                title="Socios y Capital"
                description="Gestión de composición societaria, aportes y retiros."
                tabLabel="Configuración"
                fullWidth={800}
            >
                <Suspense fallback={<LoadingFallback />}>
                    <PartnersSettingsView activeTab={activeTab} />
                </Suspense>
            </SettingsSheetRouteWrapper>
        </div>
    )
}

