"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile/context/ProfileContext"

export default function PersonalEmployeePage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="personal" activeSubTab="employee" initialProfile={profile} />
}
