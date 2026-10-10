import { PageSectionHeader } from "@/components/shared"
import { UsersSettingsClientView } from "@/features/settings"

export default function UsersSettingsPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Usuarios" description="Administración de usuarios del sistema" />
            <UsersSettingsClientView activeTab="users" />
        </>)
}
