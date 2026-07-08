import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import InventorySettingsPageClient from "./InventorySettingsPageClient"

export const metadata: Metadata = {
    title: "Configuración de Inventario | ERPGrafico",
}

export default function InventorySettingsPage() {
    return (
        <>
            <PageSectionHeader title="Configuración de Inventario" description="Parámetros generales del módulo de inventario" />
            <InventorySettingsPageClient />
        </>)
}
