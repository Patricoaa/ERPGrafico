import { redirect } from "next/navigation"
import { MODULE_ORDER, getModuleDefaultUrl } from "@/lib/module-registry"

export default function DashboardPage() {
    redirect(getModuleDefaultUrl(MODULE_ORDER[0]))
}
