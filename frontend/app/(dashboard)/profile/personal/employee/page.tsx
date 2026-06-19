"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalEmployeePage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="personal" activeSubTab="employee" initialProfile={profile} />
}
