import { redirect } from "next/navigation"

export default async function TreasurySettingsPage() {
    redirect("/accounting/settings/accounts")
}
