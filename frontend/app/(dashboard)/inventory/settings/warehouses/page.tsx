import { redirect } from "next/navigation"

export default async function SettingsWarehousesPage() {
    redirect("/inventory/stock/warehouses")
}
