import { redirect } from "next/navigation"

export default function HRSettingsGlobalPage() {
    redirect("/hr/employees?modal=settings&tab=global")
}
