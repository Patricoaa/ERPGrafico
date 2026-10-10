import { PageSectionHeader } from "@/components/shared"
import { VatRatesView } from "@/features/settings"

export default function VatRatesPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Tasas de IVA" description="Configuración de tasas impositivas" />
            <VatRatesView />
        </>)
}
