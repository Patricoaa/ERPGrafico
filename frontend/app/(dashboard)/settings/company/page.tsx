import { redirect } from "next/navigation"

export default async function CompanySettingsPage() {
    redirect("/settings/company/general")
}
