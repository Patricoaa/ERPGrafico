"use client"

import { ProfileView } from "@/features/profile"
import { useMyProfile } from "@/features/profile"

export default function PersonalEmployeePage() {
    const { profile } = useMyProfile()
    return (
        <>
            <ProfileView activeSection="employee" initialProfile={profile} />
        </>)
}
