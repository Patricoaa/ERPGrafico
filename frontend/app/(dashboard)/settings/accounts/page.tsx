import { redirect } from "next/navigation"
import { DEFAULT_ACCOUNT_TAB } from "@/features/settings"

export default function SettingsAccountsPage() {
    redirect(`/settings/accounts/${DEFAULT_ACCOUNT_TAB}`)
}
