"use client"

import { lazy, Suspense } from "react"
import { SkeletonShell, SimpleTable, ToolbarCreateButton } from "@/components/shared"
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
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..."><SimpleTable rows={10} columns={6} /></SkeletonShell>}>
                <ContactsClientView isNewModalOpen={isNewModalOpen} createAction={createAction} />
            </Suspense>
        </div>
    )
}
