import type { Metadata } from "next"
import SettingsPageClient from "./SettingsPageClient"

export const metadata: Metadata = {
    title: "Configuración | ERPGrafico",
}

export default function SettingsPage() {
    return <SettingsPageClient />
}
