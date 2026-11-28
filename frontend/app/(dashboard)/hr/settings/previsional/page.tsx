import { redirect } from "next/navigation"

export default function HRSettingsPrevisionalPage() {
    redirect("/hr/employees?modal=settings&tab=previsional")
}
