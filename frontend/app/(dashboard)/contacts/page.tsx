"use client"

import { lazy, Suspense } from "react"
import { ToolbarCreateButton } from "@/components/shared"
import { useRouter, useSearchParams } from "next/navigation"
import { ContactsClientView } from "@/features/contacts"

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
        <ContactsClientView isNewModalOpen={isNewModalOpen} createAction={createAction} />
    )
}
