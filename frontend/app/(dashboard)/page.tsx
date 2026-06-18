import type { Metadata } from "next"
import DashboardPageClient from "./DashboardPageClient"

export const metadata: Metadata = {
    title: "Dashboard | ERPGrafico",
}

export default function DashboardPage() {
    return <DashboardPageClient />
}
