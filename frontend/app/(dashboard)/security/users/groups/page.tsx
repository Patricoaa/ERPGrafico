import type { Metadata } from "next"
import { UsersSettingsClientView } from "@/features/settings"

export const metadata: Metadata = {
  title: "Roles y Permisos | Seguridad",
  description: "Grupos de usuarios y asignación de políticas de acceso",
}

export default function SecurityGroupsPage() {
  return <UsersSettingsClientView activeTab="groups" />
}
