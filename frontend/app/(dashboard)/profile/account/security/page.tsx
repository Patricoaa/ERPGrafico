"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function AccountSecurityPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader title="Seguridad" description="Gestión de contraseña y seguridad de la cuenta" />
            <ProfileView activeTab="account" activeSubTab="security" initialProfile={profile} />
        </>)
}
