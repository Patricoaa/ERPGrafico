"use client"

import { usePathname } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  SALES_TABS,
  SALES_ORDERS_SUB_TABS,
  SALES_POS_SUB_TABS,
  SALES_CREDITS_SUB_TABS,
  SALES_CONFIG_SUB_TABS,
  getSalesTab,
  getSalesOrdersSubTab,
  getSalesPosSubTab,
  getSalesCreditsSubTab,
  getSalesConfigSubTab,
  getSalesDtesSubTab,
  getSalesReturnsSubTab,
} from "@/features/sales/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function SalesHeader() {
  const pathname = usePathname()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "orders"

  // Map physical routes to tab values
  const segmentToTab: Record<string, string> = {
    orders: "orders",
    dtes: "dtes",
    pos: "pos",
    credits: "credits",
    sessions: "pos",
    settings: "config",
    returns: "orders", // returns is a sub-tab of orders
  }

  const activeValue = segmentToTab[currentSegment] || "orders"

  // Determine subActiveValue from path segments
  const subActiveValue = (() => {
    if (activeValue === "config") return segments[2] || "credit"
    if (activeValue === "orders") return segments[2] || "orders"
    if (activeValue === "dtes") return segments[2] || "dtes"
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
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("sales.saleorder", "/sales/orders"),
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
    if (activeValue === "orders" && subActiveValue) {
      const subTab = getSalesOrdersSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

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