import { PageSectionHeader } from "@/components/shared"
import { UsersSettingsView } from "@/features/settings"

export default function UsersSettingsPage() {
    return (
        <>
            <PageSectionHeader title="Usuarios" description="Administración de usuarios del sistema" />
            <UsersSettingsView activeTab="users" />
        </>)
}
