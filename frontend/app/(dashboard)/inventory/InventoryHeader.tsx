"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  INVENTORY_TABS,
  getInventoryTab,
  getInventoryProductsSubTab,
  getInventoryOperationsSubTab,
} from "@/features/inventory/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const InventorySettingsModal = dynamic(
  () => import("@/features/inventory").then(m => ({ default: m.InventorySettingsModal })),
  { ssr: false },
)

export function InventoryHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getViewModeUrl } = useViewModePreference()
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get("modal") === "settings")
  const initialSection = searchParams.get("tab") || undefined

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "products"

  const activeValue = currentSegment

  const subActiveValue = (() => {
    if (activeValue === "products") return segments[2] || "products"
    if (activeValue === "operations") return segments[2] || "warehouses"
    return undefined
  })()

  const moduleConfig = getModuleHeaderConfig("inventory")

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

  const getHeaderConfig = () => {
    const mainTab = getInventoryTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Inventario", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "package" as const }
    }

    if (activeValue === "products" && subActiveValue) {
      const subTab = getInventoryProductsSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "operations" && subActiveValue) {
      const subTab = getInventoryOperationsSubTab(subActiveValue)
      if (subTab) {
        if (subActiveValue === "stock") {
          const productName = searchParams.get("product_name")
          if (productName) return { ...buildHeaderConfigFromTab(subTab), title: productName }
        }
        return buildHeaderConfigFromTab(subTab)
      }
    }

    return buildHeaderConfigFromTab(mainTab)
  }

  const config = getHeaderConfig()

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        iconName={config.iconName}
        variant="minimal"
        navigation={navigation}
        titleActions={
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSettingsOpen(true)} title="Configuración de Inventario">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      {isSettingsOpen && (
        <InventorySettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}
