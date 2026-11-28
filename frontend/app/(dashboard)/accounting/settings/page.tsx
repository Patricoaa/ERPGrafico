import { redirect } from "next/navigation"

export default function AccountingSettingsPage() {
    redirect("/accounting/ledger?modal=settings&tab=vat-rates")
}
