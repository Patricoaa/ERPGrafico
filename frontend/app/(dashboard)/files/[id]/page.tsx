import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { AttachmentDetailClient } from "@/components/shared/AttachmentDetailClient"

export const metadata: Metadata = {
    title: "Archivo | ERP Gráfico",
    description: "Detalle de archivo adjunto.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function AttachmentDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <AttachmentDetailClient attachmentId={id} />
        </Suspense>
    )
}
