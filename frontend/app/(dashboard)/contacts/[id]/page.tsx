import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { ContactDetailClient } from "@/features/contacts/components/ContactDetailClient"

export const metadata: Metadata = {
    title: "Contacto | ERP Gráfico",
    description: "Detalle de contacto.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ContactDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <ContactDetailClient contactId={id} />
        </Suspense>
    )
}
