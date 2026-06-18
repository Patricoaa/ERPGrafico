import { redirect } from "next/navigation"

export default async function BillingSettingsPage() {
    redirect("/accounting/settings/accounts")
}
