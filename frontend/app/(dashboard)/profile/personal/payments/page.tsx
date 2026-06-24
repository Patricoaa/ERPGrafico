"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalPaymentsPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader title="Mis Pagos" description="Historial de pagos y beneficios recibidos" />
            <ProfileView activeTab="personal" activeSubTab="payments" initialProfile={profile} />
        </>)
}
