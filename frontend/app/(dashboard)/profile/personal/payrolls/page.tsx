"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalPayrollsPage() {
    const { profile } = useMyProfile()
    return (
        <>
            <ProfileView activeSection="payrolls" initialProfile={profile} />
        </>)
}
