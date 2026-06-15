"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile/context/ProfileContext"

export default function PartnerPage() {
    const { profile } = useMyProfile()
    return <ProfileView activeTab="partner" initialProfile={profile} />
}
