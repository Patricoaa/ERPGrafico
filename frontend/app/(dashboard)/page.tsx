import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import DashboardPageClient from "./DashboardPageClient"

export const metadata: Metadata = {
    title: "Dashboard | ERPGrafico",
}

export default function DashboardPage() {
    return (
        <>
            <PageSectionHeader title="Dashboard" description="Panel de indicadores y resumen general" />
            <DashboardPageClient />
        </>)
}
