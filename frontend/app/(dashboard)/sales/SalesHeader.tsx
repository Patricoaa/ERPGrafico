"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  SALES_TABS,
  getSalesTab,
  getSalesPosSubTab,
  getSalesCreditsSubTab,
  getSalesConfigSubTab,
  getSalesDtesSubTab,
} from "@/features/sales/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function SalesHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "docs"

  // Map physical routes to tab values (ADR-0090: `dtes` y `docs` corresponden al tab Documentos y
  // contienen orders/fulfillment como sub-segmentos; `settings` es tab propio).
  const segmentToTab: Record<string, string> = {
    docs: "dtes",
    dtes: "dtes",
    pos: "pos",
    credits: "credits",
    sessions: "pos",
    settings: "config",
  }

  const activeValue = segmentToTab[currentSegment] || "dtes"

  // Determine subActiveValue from path segments
  const subActiveValue = (() => {
    if (activeValue === "config") return segments[2] || "credit"
    if (activeValue === "dtes") {
      if (currentSegment === "docs") return "orders"
      return segments[2] || "dtes"
    }
    if (activeValue === "pos") {
      if (currentSegment === "sessions") return "sessions"
      return segments[2] || "cajas"
    }
    if (activeValue === "credits") return segments[2] || "portfolio"
    return undefined
  })()

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("sales")

  // Build navigation from canonical config
  const tabs = SALES_TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    iconName: tab.iconName,
    href: tab.href,
    subTabs: tab.subTabs?.map((st) => ({
      value: st.value,
      label: st.label,
      iconName: st.iconName,
      href: st.href,
    })),
  }))

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Ventas",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("sales.saleorder", "/sales/docs"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getSalesTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Ventas", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "shopping-cart" as const }
    }

    // Sub-tabs handling
    if (activeValue === "dtes" && subActiveValue) {
      const subTab = getSalesDtesSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "pos" && subActiveValue) {
      const subTab = getSalesPosSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "credits" && subActiveValue) {
      const subTab = getSalesCreditsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "config" && subActiveValue) {
      const subTab = getSalesConfigSubTab(subActiveValue)
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