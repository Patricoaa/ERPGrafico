import { PageSectionHeader } from "@/components/shared"
import { CompanySettingsView } from "@/features/settings"

export default async function CompanySettingsBrandingPage() {
    return (
        <>
            <PageSectionHeader title="Branding" description="Personalización de imagen corporativa y marca" />
            <CompanySettingsView activeTab="branding" />
        </>)
}
