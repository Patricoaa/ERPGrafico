import { redirect } from "next/navigation"

export default function InventorySettingsPage() {
    redirect("/inventory/products?modal=settings&tab=valuation")
}
