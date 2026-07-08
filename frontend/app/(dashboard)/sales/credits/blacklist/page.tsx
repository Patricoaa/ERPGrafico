import { PageSectionHeader } from "@/components/shared"
import { BlacklistClientView } from "@/features/credits"

export default async function CreditsBlacklistPage() {
    return (
        <>
            <PageSectionHeader title="Lista Negra" description="Control de deudores morosos y restricciones crediticias" />
            <BlacklistClientView />
        </>)
}
