"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile/context/ProfileContext"

export default function PersonalPaymentsPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="personal" activeSubTab="payments" initialProfile={profile} />
}
