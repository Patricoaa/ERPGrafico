import { getMyProfile } from "@/features/profile"
import { ProfileLayoutClient } from "./ProfileLayoutClient"

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
    let profile = null
    try {
        profile = await getMyProfile()
    } catch {
        // Profile fetch failed — client wrapper handles fallback
    }

    return <ProfileLayoutClient profile={profile}>{children}</ProfileLayoutClient>
}
