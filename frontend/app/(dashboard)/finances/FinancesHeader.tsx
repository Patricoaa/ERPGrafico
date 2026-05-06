"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"

export function FinancesHeader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const segments = pathname.split('/').filter(Boolean)
    const currentSegment = segments[1] || 'statements'

    const activeValue = currentSegment
    const subActiveValue = searchParams.get('tab')

    const tabs = [
        {
            value: "statements",
            label: "Estados Financieros",
            iconName: "clipboard-list",
            href: "/finances/statements",
            subTabs: [
                { value: "bs", label: "Balance", iconName: "file-text", href: "/finances/statements?tab=bs" },
                { value: "pl", label: "Resultados", iconName: "bar-chart-2", href: "/finances/statements?tab=pl" },
                { value: "cf", label: "Flujos", iconName: "trending-up", href: "/finances/statements?tab=cf" },
            ]
        },
        {
            value: "analysis",
            label: "Análisis",
            iconName: "line-chart",
            href: "/finances/analysis",
            subTabs: [
                { value: "ratios", label: "Ratios Financieros", iconName: "pie-chart", href: "/finances/analysis?tab=ratios" },
                { value: "bi", label: "Business Intelligence", iconName: "activity", href: "/finances/analysis?tab=bi" },
            ]
        },
        {
            value: "budgets",
            label: "Presupuestos",
            iconName: "target",
            href: "/finances/budgets",
            subTabs: [
                { value: "list", label: "Gestión", iconName: "list", href: "/finances/budgets?tab=list" },
                { value: "versus", label: "Versus", iconName: "chart-bar", href: "/finances/budgets?tab=versus" },
            ]
        },
    ]

    const navigation = {
        moduleName: "Finanzas",
        moduleHref: "/finances",
        tabs,
        activeValue,
        subActiveValue,
        configHref: "/finances/settings"
    }

    const getHeaderConfig = () => {
        if (activeValue === 'statements') {
            if (subActiveValue === 'bs') return { title: "Balance General", description: "Estado de situación financiera resumido.", iconName: "file-text" as const }
            if (subActiveValue === 'pl') return { title: "Estado de Resultados", description: "Pérdidas y ganancias en un periodo determinado.", iconName: "bar-chart-2" as const }
            if (subActiveValue === 'cf') return { title: "Flujo de Caja", description: "Análisis de entradas y salidas de efectivo.", iconName: "trending-up" as const }
            return { title: "Estados Financieros", description: "Reportes oficiales de Balance, P&L y Flujo de Caja.", iconName: "clipboard-list" as const }
        }
        if (activeValue === 'analysis') {
            if (subActiveValue === 'bi') return { title: "Business Intelligence", description: "Análisis visual de métricas de rentabilidad y evolución.", iconName: "activity" as const }
            if (subActiveValue === 'ratios') return { title: "Ratios Financieros", description: "Métricas de liquidez, solvencia y rentabilidad.", iconName: "pie-chart" as const }
            return { title: "Análisis Financiero", description: "Visualización de ratios, KPIs e inteligencia de negocio.", iconName: "line-chart" as const }
        }
        if (activeValue === 'budgets') {
            if (subActiveValue === 'versus') return { title: "Versus Presupuestario", description: "Análisis de variaciones mes y acumulado.", iconName: "chart-bar" as const }
            return { title: "Control Presupuestario", description: "Gestión de metas presupuestarias y ejecución.", iconName: "target" as const }
        }
        return { title: "Finanzas", description: "", iconName: "trending-up" as const }
    }

    const config = getHeaderConfig()

    return (
        <PageHeader 
            title={config.title} 
            description={config.description} 
            iconName={config.iconName} 
            variant="minimal" 
            navigation={navigation} 
        />
    )
}
