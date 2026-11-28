import { redirect } from "next/navigation"

export default function HRSettingsPage() {
    redirect("/hr/employees?modal=settings&tab=global")
}
