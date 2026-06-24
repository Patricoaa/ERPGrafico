"use client"

import { PageSectionHeader } from "@/components/shared"
import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalEmployeePage() {
    const { profile } = useMyProfile()
    return (
        <>
            <PageSectionHeader title="Datos del Empleado" description="Información laboral y datos personales" />
            <ProfileView activeTab="personal" activeSubTab="employee" initialProfile={profile} />
        </>)
}
