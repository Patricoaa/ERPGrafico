import type { Metadata } from "next"
import { UsersSettingsClientView } from "@/features/settings"

export const metadata: Metadata = {
  title: "Usuarios | Seguridad",
  description: "Gestión de cuentas y accesos de usuario",
}

export default function SecurityUsersPage() {
  return <UsersSettingsClientView activeTab="users" />
}
