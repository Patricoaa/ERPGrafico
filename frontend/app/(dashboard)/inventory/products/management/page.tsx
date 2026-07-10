import { redirect } from "next/navigation"

export default async function ProductsManagementPage() {
    redirect("/inventory/products/categories")
}
