import { redirect } from "next/navigation"

export default async function SettingsProductsPage() {
    redirect("/inventory/products/categories")
}
