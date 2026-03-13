import { redirect } from "next/navigation"

export default function DashboardRedirect() {
    redirect("/treasury/reconciliation?tab=dashboard")
}
