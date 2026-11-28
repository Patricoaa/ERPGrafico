import type { Metadata } from "next"
import { DebugSettingsView } from "@/features/settings"

export const metadata: Metadata = {
  title: "Depuración | Seguridad",
  description: "Herramientas de depuración para desarrollo, como el reloj del servidor",
}

export default function SecurityDebugPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <DebugSettingsView />
    </div>
  )
}
