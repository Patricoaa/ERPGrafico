import React from "react"
import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { StatementsList, ReconciliationDashboard, ReconciliationIntelligence, ReconciliationBreadcrumbs } from "@/features/finance/bank-reconciliation/components"


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
        { value: "intelligence", label: "Inteligencia", iconName: "brain", href: "/treasury/reconciliation?tab=intelligence" },
    ]

    const navigation = {
        tabs: [
            { value: "movements", label: "Movimientos", iconName: "banknote", href: "/treasury?view=movements" },
            { 
                value: "accounts", 
                label: "Cuentas y Caja", 
                iconName: "landmark", 
                href: "/treasury?view=accounts",
                subTabs: [
                    { value: "accounts", label: "Cuentas", href: "/treasury?view=accounts&sub=accounts" },
                    { value: "banks", label: "Bancos", href: "/treasury?view=accounts&sub=banks" },
                    { value: "methods", label: "Métodos", href: "/treasury?view=accounts&sub=methods" },
                ]
            },
            { 
                value: "reconciliation", 
                label: "Conciliación", 
                iconName: "history", 
                href: "/treasury?view=reconciliation",
                subTabs: [
                    { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury?view=reconciliation&sub=statements" },
                    { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury?view=reconciliation&sub=dashboard" },
                    { value: "intelligence", label: "Inteligencia", iconName: "brain", href: "/treasury/reconciliation?tab=intelligence" },
                ]
            },
            { 
                value: "config", 
                label: "Config", 
                iconName: "settings", 
                href: "/treasury?view=config",
                subTabs: [
                    { value: "conciliation", label: "Conciliación", href: "/treasury?view=config&tab=conciliation", iconName: "arrow-left-right" },
                    { value: "audit", label: "Arqueo", href: "/treasury?view=config&tab=audit", iconName: "banknote" },
                    { value: "movements", label: "Movimientos", href: "/treasury?view=config&tab=movements", iconName: "settings-2" }
                ]
            },
        ],
        activeValue: "reconciliation",
        subActiveValue: activeTab
    }

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
            case "intelligence":
                return {
                    title: "Inteligencia de Conciliación",
                    description: "Configura pesos y umbrales para el matching automático por cuenta.",
                }
            default:
                return {
                    title: "Conciliación Bancaria",
                    description: "",
                }
        }
    }

    const { title, description } = getHeaderConfig()

    const statementsCreateAction = (
        <ToolbarCreateButton
            label="Importar Cartola"
            iconName="upload"
            href="/treasury/reconciliation?tab=statements&modal=import"
        />
    )

    const intelligenceCreateAction = (
        <ToolbarCreateButton
            label="Ajustar Inteligencia"
            href="/treasury/reconciliation?tab=intelligence"
        />
    )

    return (
        <div className={LAYOUT_TOKENS.view}>
            <ReconciliationBreadcrumbs />
            <PageHeader
                title={title}
                description={description}
                iconName="landmark"
                variant="minimal"
                navigation={navigation}
            />

            <div className="pt-4">
                <Tabs value={activeTab} className="space-y-4">
                    <TabsContent value="statements" className="mt-0 outline-none">
                        <StatementsList externalOpen={modalOpen} createAction={statementsCreateAction} />
                    </TabsContent>
                    <TabsContent value="dashboard" className="mt-0 outline-none">
                        <ReconciliationDashboard />
                    </TabsContent>
                    <TabsContent value="intelligence" className="mt-0 outline-none">
                        <ReconciliationIntelligence externalOpen={resolvedParams.modal === "new-rule"} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
