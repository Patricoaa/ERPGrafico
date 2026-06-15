"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile/context/ProfileContext"

export default function PersonalPayrollsPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="personal" activeSubTab="payrolls" initialProfile={profile} />
}
