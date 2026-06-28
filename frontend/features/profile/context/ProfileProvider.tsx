"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { MyProfile } from "@/types/profile"
import type { ContactMini } from "@/types/hr"

interface ProfileContextValue {
    profile: MyProfile
    isPartner: boolean
    contactDetail: ContactMini | null | undefined
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ profile, children }: { profile: MyProfile; children: ReactNode }) {
    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = !!contactDetail?.is_partner

    return (
        <ProfileContext.Provider value={{ profile, isPartner, contactDetail }}>
            {children}
        </ProfileContext.Provider>
    )
}

export function useMyProfile(): ProfileContextValue {
    const ctx = useContext(ProfileContext)
    if (!ctx) throw new Error("useMyProfile must be used within ProfileProvider")
    return ctx
}
