"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PartnerPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="partner" initialProfile={profile} />
}
