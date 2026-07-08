"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PartnerPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader title="Perfil de Socio" description="Información del socio y datos de participación" />
            <ProfileView activeTab="partner" initialProfile={profile} />
        </>)
}
