import { Metadata } from "next"
import { Suspense } from "react"
import { FormSkeleton } from "@/components/shared"
import { UserDetailClient } from "@/features/users/components/UserDetailClient"

export const metadata: Metadata = {
    title: "Usuario | ERP Gráfico",
    description: "Detalle de perfil de usuario.",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: PageProps) {
    const { id } = await params
    return (
        <Suspense fallback={<div className="p-8"><FormSkeleton /></div>}>
            <UserDetailClient userId={id} />
        </Suspense>
    )
}
