import { redirect } from "next/navigation"

export default async function SettingsUoMsPage() {
    redirect("/inventory/settings/measure-categories")
}
