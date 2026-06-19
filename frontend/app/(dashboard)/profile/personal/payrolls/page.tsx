"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalPayrollsPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="personal" activeSubTab="payrolls" initialProfile={profile} />
}
