"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalPayrollsPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader as="h1" title="Mis Remuneraciones" description="Historial de liquidaciones de sueldo" />
            <ProfileView activeTab="personal" activeSubTab="payrolls" initialProfile={profile} />
        </>)
}
