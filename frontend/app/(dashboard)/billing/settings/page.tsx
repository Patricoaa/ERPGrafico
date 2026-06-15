import { redirect } from "next/navigation"

export default async function BillingSettingsPage() {
    redirect("/billing/settings/accounts")
}
