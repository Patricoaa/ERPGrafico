import { redirect } from "next/navigation"

export default function RulesRedirect() {
    redirect("/treasury/reconciliation?tab=rules")
}
