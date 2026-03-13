import React from "react"
import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { StatementsList } from "./StatementsList"
import Link from "next/link"

const ReconciliationDashboard = dynamic(

    () => import("./ReconciliationDashboard").then(mod => mod.ReconciliationDashboard),
    {
        loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />
    }
)


const ReconciliationRules = dynamic(
    () => import("./ReconciliationRules").then(mod => mod.ReconciliationRules),
    {
        loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />
    }
)


export const metadata: Metadata = {
    title: "Conciliación Bancaria | ERPGrafico",
    description: "Gestión de cartolas y cuadratura de movimientos bancarios.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const activeTab = resolvedParams.tab || "statements"
    const modalOpen = resolvedParams.modal === "import"

    const tabs = [
        { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury/reconciliation?tab=statements" },
        { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury/reconciliation?tab=dashboard" },
        { value: "rules", label: "Reglas", iconName: "wand-2", href: "/treasury/reconciliation?tab=rules" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "statements":
                return {
                    title: "Conciliación Bancaria",
                    description: "Gestión de cartolas y cuadratura de movimientos bancarios.",
                }
            case "dashboard":
                return {
                    title: "Dashboard de Conciliación",
                    description: "Estadísticas y métricas de conciliación bancaria.",
                }
            case "rules":
                return {
                    title: "Reglas de Matching",
                    description: "Configura la automatización de reconciliación.",
                }
            default:
                return {
                    title: "Conciliación Bancaria",
                    description: "",
                }
        }
    }

    const { title, description } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={
                        activeTab === "statements" ? (
                            <Link href="/treasury/reconciliation?tab=statements&modal=import">
                                <PageHeaderButton
                                    iconName="upload"
                                    circular
                                />
                            </Link>
                        ) : activeTab === "rules" ? (
                            <Link href="/treasury/reconciliation?tab=rules&modal=new-rule">
                                <PageHeaderButton
                                    iconName="plus"
                                    circular
                                />
                            </Link>
                        ) : null
                    }
                />

                <div className="pt-4">
                    <TabsContent value="statements" className="mt-0 outline-none">
                        <StatementsList externalOpen={modalOpen} />
                    </TabsContent>
                    <TabsContent value="dashboard" className="mt-0 outline-none">
                        <ReconciliationDashboard />
                    </TabsContent>
                    <TabsContent value="rules" className="mt-0 outline-none">
                        <ReconciliationRules externalOpen={resolvedParams.modal === "new-rule"} />
                    </TabsContent>
                </div>

            </Tabs>
        </div>
    )
}
