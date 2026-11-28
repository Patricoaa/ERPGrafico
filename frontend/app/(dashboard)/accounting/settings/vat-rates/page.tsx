import { redirect } from "next/navigation"

export default function AccountingSettingsVatRatesPage() {
    redirect("/accounting/ledger?modal=settings&tab=vat-rates")
}
