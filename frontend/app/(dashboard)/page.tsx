import { redirect } from "next/navigation"

export default function DashboardPage() {
    redirect("/accounting/ledger?view=list")
}
