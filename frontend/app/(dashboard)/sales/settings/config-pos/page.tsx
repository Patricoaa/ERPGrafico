import { PageSectionHeader } from "@/components/shared"
import { SalesSettingsView } from "@/features/settings"

export default async function SalesSettingsConfigPosPage() {
    return (
        <>
            <PageSectionHeader title="Configuración POS" description="Parámetros de puntos de venta y facturación" />
            <SalesSettingsView activeTab="config_pos" />
        </>)
}
