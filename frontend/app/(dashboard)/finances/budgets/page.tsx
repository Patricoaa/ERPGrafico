import { redirect } from "next/navigation"

export default async function BudgetsPage() {
    redirect("/finances/budgets/list")
}
