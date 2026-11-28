import { redirect } from "next/navigation"

export default function AccountingSettingsRcvPage() {
    redirect("/accounting/ledger?modal=settings&tab=rcv")
}
