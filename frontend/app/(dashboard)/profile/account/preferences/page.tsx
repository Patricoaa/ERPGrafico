"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function AccountPreferencesPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader title="Preferencias" description="Configuración de preferencias de usuario" />
            <ProfileView activeTab="account" activeSubTab="preferences" initialProfile={profile} />
        </>)
}
