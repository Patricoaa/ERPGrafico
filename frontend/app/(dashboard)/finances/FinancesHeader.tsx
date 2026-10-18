"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  FINANCES_TABS,
  FINANCES_STATEMENTS_SUB_TABS,
  FINANCES_ANALYSIS_SUB_TABS,
  FINANCES_BUDGETS_SUB_TABS,
  FINANCES_PARTNERS_SUB_TABS,
  getFinancesTab,
  getFinancesStatementsSubTab,
  getFinancesAnalysisSubTab,
  getFinancesBudgetsSubTab,
  getFinancesPartnersSubTab,
} from "@/features/finances/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function FinancesHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("finances")

  // Build navigation from canonical config
  const tabs = FINANCES_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    iconName: tab.iconName,
    href: tab.value === "budgets"
      ? getViewModeUrl("accounting.budget", tab.href)
      : tab.href,
    subTabs: tab.subTabs?.map((st) => ({
      value: st.value,
      label: st.label,
      iconName: st.iconName,
      href: st.value === "list"
        ? getViewModeUrl("accounting.budget", st.href)
        : st.href,
    })),
  }))

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "statements"

  const activeValue = currentSegment
  const subActiveValue = segments[2] ?? undefined

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Finanzas",
    moduleHref: moduleConfig?.moduleHref ?? "/finances",
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getFinancesTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Finanzas", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "pie-chart" as const }
    }

    // Sub-tabs handling
    if (activeValue === "statements" && subActiveValue) {
      const subTab = getFinancesStatementsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "analysis" && subActiveValue) {
      const subTab = getFinancesAnalysisSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "budgets" && subActiveValue) {
      const subTab = getFinancesBudgetsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "partners" && subActiveValue) {
      const subTab = getFinancesPartnersSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    // Default: main tab header
    return buildHeaderConfigFromTab(mainTab)
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