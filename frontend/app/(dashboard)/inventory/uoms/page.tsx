import { redirect } from "next/navigation"

export default async function UnifiedUoMPage() {
    redirect("/inventory/uoms/units")
}
