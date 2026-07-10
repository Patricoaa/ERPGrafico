import { PageSectionHeader } from "@/components/shared"
import { UsersSettingsClientView } from "@/features/settings"

export default function UsersSettingsGroupsPage() {
    return (
        <>
            <PageSectionHeader title="Grupos y Roles" description="Gestión de grupos, permisos y roles de acceso" />
            <UsersSettingsClientView activeTab="groups" />
        </>)
}
