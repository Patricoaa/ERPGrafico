import { redirect } from "next/navigation"

export default async function TreasurySettingsPage() {
    redirect("/treasury/settings/conciliation")
}
