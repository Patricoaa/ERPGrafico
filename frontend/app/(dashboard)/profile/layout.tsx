import { ProfileLayoutClient } from "./ProfileLayoutClient"

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return <ProfileLayoutClient>{children}</ProfileLayoutClient>
}
