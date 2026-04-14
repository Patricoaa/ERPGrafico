"use client"

import { lazy, Suspense } from "react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useRouter, useSearchParams } from "next/navigation"

const ContactsClientView = lazy(() =>
    import("@/features/contacts").then(m => ({ default: m.ContactsClientView }))
)

export default function ContactsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isNewModalOpen = searchParams.get("modal") === "new"

    const handleOpenNew = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("modal", "new")
        router.push(`?${params.toString()}`)
    }

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Contactos"
                description="Directorio de contactos."
                titleActions={
                    <PageHeaderButton
                        onClick={handleOpenNew}
                        iconName="plus"
                        circular
                        title="Nuevo Contacto"
                    />
                }
                iconName="users-2"
            />

            <Suspense fallback={<LoadingFallback />}>
                <ContactsClientView isNewModalOpen={isNewModalOpen} />
            </Suspense>
        </div>
    )
}
