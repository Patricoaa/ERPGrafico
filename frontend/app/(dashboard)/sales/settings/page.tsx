import { redirect } from "next/navigation"

export default function SalesSettingsPage() {
    redirect("/sales/docs?modal=settings&tab=credit")
}
