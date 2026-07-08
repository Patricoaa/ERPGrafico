import { redirect } from "next/navigation"

export default async function UnifiedStockPage() {
    redirect("/inventory/stock/report")
}
