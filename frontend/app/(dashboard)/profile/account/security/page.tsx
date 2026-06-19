"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function AccountSecurityPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="account" activeSubTab="security" initialProfile={profile} />
}
