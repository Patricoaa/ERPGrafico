import { redirect } from "next/navigation"

export default async function StockWarehousesPage() {
    redirect("/inventory/settings/warehouses")
}
