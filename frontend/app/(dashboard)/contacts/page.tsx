"use client"

import { lazy, Suspense } from "react"
import { PageHeader, TableSkeleton, ToolbarCreateButton } from "@/components/shared"
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

    const createAction = (
        <ToolbarCreateButton
            label="Nuevo Contacto"
            onClick={handleOpenNew}
        />
    )

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Contactos"
                description="Directorio de contactos."
                iconName="users-2"
            />
            <div className="pt-2">
                <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                    <ContactsClientView isNewModalOpen={isNewModalOpen} createAction={createAction} />
                </Suspense>
            </div>
        </div>
    )
}
