"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function AccountPreferencesPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="account" activeSubTab="preferences" initialProfile={profile} />
}
