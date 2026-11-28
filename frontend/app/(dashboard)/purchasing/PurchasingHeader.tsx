"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  PURCHASING_TABS,
  getPurchasingTab,
  getPurchasingDtesSubTab,
} from "@/features/purchasing/navigation"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const PurchasingSettingsModal = dynamic(
  () => import("@/features/purchasing").then(m => ({ default: m.PurchasingSettingsModal })),
  { ssr: false },
)

export function PurchasingHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getViewModeUrl } = useViewModePreference()
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get("modal") === "settings")
  const initialSection = searchParams.get("tab") || undefined

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "docs"

  const segmentToTab: Record<string, string> = {
    docs: "dtes",
    dtes: "dtes",
  }

  const activeValue = segmentToTab[currentSegment] || "dtes"

  const subActiveValue = (() => {
    if (activeValue === "dtes") {
      if (currentSegment === "docs") return "orders"
      return segments[2] || "dtes"
    }
    return undefined
  })()

  const moduleConfig = getModuleHeaderConfig("purchasing")

  const tabs = PURCHASING_TABS.map((tab) => ({
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
    moduleName: moduleConfig?.moduleName ?? "Compras",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("purchasing.purchaseorder", "/purchasing/docs"),
    tabs,
    activeValue,
    subActiveValue,
  }

  const getHeaderConfig = () => {
    const mainTab = getPurchasingTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Compras", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "shopping-bag" as const }
    }

    if (activeValue === "dtes" && subActiveValue) {
      const subTab = getPurchasingDtesSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSettingsOpen(true)} title="Configuración de Compras">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      {isSettingsOpen && (
        <PurchasingSettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}
