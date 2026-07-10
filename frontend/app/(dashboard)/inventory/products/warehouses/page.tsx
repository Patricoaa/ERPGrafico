import { redirect } from "next/navigation"

export default async function ProductsWarehousesPage() {
    redirect("/inventory/stock/warehouses")
}
