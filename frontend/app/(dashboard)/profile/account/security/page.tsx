"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile/context/ProfileContext"

export default function AccountSecurityPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="account" activeSubTab="security" initialProfile={profile} />
}
