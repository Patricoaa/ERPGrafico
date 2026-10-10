import { PageSectionHeader } from "@/components/shared"
import { CompanySettingsView } from "@/features/settings"

export default async function CompanySettingsBrandingPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Branding" description="Personalización de imagen corporativa y marca" />
            <CompanySettingsView activeTab="branding" />
        </>)
}
