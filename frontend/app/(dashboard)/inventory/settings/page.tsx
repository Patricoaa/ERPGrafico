import type { Metadata } from "next"
import InventorySettingsPageClient from "./InventorySettingsPageClient"

export const metadata: Metadata = {
    title: "Configuración de Inventario | ERPGrafico",
}

export default function InventorySettingsPage() {
    return <InventorySettingsPageClient />
}
