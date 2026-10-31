"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function AccountSecurityPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <ProfileView activeSection="security" initialProfile={profile} />
        </>)
}
