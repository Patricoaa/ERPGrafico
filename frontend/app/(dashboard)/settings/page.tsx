import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import SettingsPageClient from "./SettingsPageClient"

export const metadata: Metadata = {
    title: "Configuración | ERPGrafico",
}

export default function SettingsPage() {
    return (
        <>
            <PageSectionHeader title="Configuración" description="Administración general del sistema" />
            <SettingsPageClient />
        </>)
}
