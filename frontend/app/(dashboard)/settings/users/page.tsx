import { PageSectionHeader } from "@/components/shared"
import { UsersSettingsClientView } from "@/features/settings"

export default function UsersSettingsPage() {
    return (
        <>
            <PageSectionHeader title="Usuarios" description="Administración de usuarios del sistema" />
            <UsersSettingsClientView activeTab="users" />
        </>)
}
