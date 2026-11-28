"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  SALES_TABS,
  getSalesTab,
  getSalesPosSubTab,
  getSalesCreditsSubTab,
  getSalesDtesSubTab,
} from "@/features/sales/navigation"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { buildHeaderConfigFromTab } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const SalesSettingsModal = dynamic(
  () => import("@/features/sales").then(m => ({ default: m.SalesSettingsModal })),
  { ssr: false },
)

export function SalesHeader() {
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
    pos: "pos",
    credits: "credits",
    sessions: "pos",
  }

  const activeValue = segmentToTab[currentSegment] || "dtes"

  const subActiveValue = (() => {
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

  const moduleConfig = getModuleHeaderConfig("sales")

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

  const getHeaderConfig = () => {
    const mainTab = getSalesTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Ventas", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "shopping-cart" as const }
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
          <Button variant="ghost" size="icon" className="size-control-xs" onClick={() => setIsSettingsOpen(true)} title="Configuración de Ventas">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      {isSettingsOpen && (
        <SalesSettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}