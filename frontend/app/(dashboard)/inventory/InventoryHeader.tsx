"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  INVENTORY_TABS,
  INVENTORY_PRODUCTS_SUB_TABS,
  INVENTORY_REPORTS_SUB_TABS,
  INVENTORY_OPERATIONS_SUB_TABS,
  INVENTORY_CONFIG_SUB_TABS,
  getInventoryTab,
  getInventoryProductsSubTab,
  getInventoryReportsSubTab,
  getInventoryOperationsSubTab,
  getInventoryConfigSubTab,
} from "@/features/inventory/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function InventoryHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "products"

  const activeValue = currentSegment === "settings" ? "config" : currentSegment

  const subActiveValue = (() => {
    if (activeValue === "products") {
      return segments[2] || "products"
    }
    if (activeValue === "reports") return segments[2] || "stock"
    if (activeValue === "operations") return segments[2] || "warehouses"
    if (activeValue === "config") return segments[2] || "valuation"
    return undefined
  })()

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("inventory")

  // Build navigation from canonical config
  const tabs = INVENTORY_TABS.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Inventario",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("inventory.product", "/inventory/products"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getInventoryTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Inventario", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "package" as const }
    }

    // Sub-tabs handling
    if (activeValue === "products" && subActiveValue) {
      const subTab = getInventoryProductsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "reports" && subActiveValue) {
      const productName = searchParams.get("product_name")
      const subTab = getInventoryReportsSubTab(subActiveValue)
      if (subTab) {
        if (subActiveValue === "stock" && productName) {
          return { ...buildHeaderConfigFromTab(subTab), title: productName }
        }
        return buildHeaderConfigFromTab(subTab)
      }
    }

    if (activeValue === "operations" && subActiveValue) {
      const subTab = getInventoryOperationsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "config" && subActiveValue) {
      const subTab = getInventoryConfigSubTab(subActiveValue)
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