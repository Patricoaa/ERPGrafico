"use client"

import { ToolbarCreateButton } from "@/components/shared"
import { useRouter, useSearchParams } from "next/navigation"
import { ContactsClientView } from "@/features/contacts"
import type { Contact } from "@/features/contacts"

interface ContactsPageClientProps {
    initialContacts?: Contact[]
}

export default function ContactsPageClient({ initialContacts }: ContactsPageClientProps) {
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
        <ContactsClientView isNewModalOpen={isNewModalOpen} createAction={createAction} initialContacts={initialContacts} />
    )
}
