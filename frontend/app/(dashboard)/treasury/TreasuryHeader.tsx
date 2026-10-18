"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { PageHeader } from "@/components/shared"
import { useBanks } from "@/features/treasury"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  TREASURY_TABS,
  OPERACIONES_SUB_TABS,
  TERMINAL_COBRO_SUB_TABS,
  buildBankSubTabs,
  getTreasuryTab,
  getOperacionesSubTab,
  getTerminalCobroSubTab,
  getBankSubView,
} from "@/features/treasury/navigation"
import { buildHeaderConfigFromTab, overrideHeaderConfig } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

export function TreasuryHeader() {
  const pathname = usePathname()
  const { banks } = useBanks()
  const { getViewModeUrl } = useViewModePreference()

  const segments = pathname.split("/").filter(Boolean)
  const currentSegment = segments[1] || "operaciones"

  const segmentToTab: Record<string, string> = {
    operaciones: "operaciones",
    "bank-center": "bank-center",
    "terminal-cobro": "terminal-cobro",
  }

  const activeValue = segmentToTab[currentSegment] || "operaciones"

  const subActiveValue = useMemo(() => {
    if (activeValue === "operaciones") return segments[2] || "movements"
    if (activeValue === "terminal-cobro") return segments[2] || "providers"
    if (activeValue === "bank-center") {
      const bankIdSegment = segments[2]
      if (bankIdSegment && !isNaN(Number(bankIdSegment))) return `bank-${bankIdSegment}`
      return "all"
    }
    return undefined
  }, [activeValue, segments])

  const bankSubTabs = useMemo(() => buildBankSubTabs(banks), [banks])

  // Module config from centralized registry
  const moduleConfig = getModuleHeaderConfig("treasury")

  // Build navigation from canonical config
  const tabs = useMemo(() => {
    const baseTabs = TREASURY_TABS.map((tab) => ({
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

    // Replace bank-center subTabs with dynamic ones
    return baseTabs.map((tab) =>
      tab.value === "bank-center" ? { ...tab, subTabs: bankSubTabs } : tab
    )
  }, [bankSubTabs])

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Tesorería",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("treasury.treasurymovement", "/treasury/operaciones/movements"),
    tabs,
    activeValue,
    subActiveValue,
  }

  // Get header config from canonical navigation
  const getHeaderConfig = () => {
    const mainTab = getTreasuryTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Tesorería", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "banknote" as const }
    }

    // Sub-tabs handling
    if (activeValue === "operaciones" && subActiveValue) {
      const subTab = getOperacionesSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "terminal-cobro" && subActiveValue) {
      const subTab = getTerminalCobroSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "bank-center" && subActiveValue) {
      const bankTab = getBankSubView(bankSubTabs, subActiveValue, segments[3] || "overview")
      if (bankTab) {
        // Para banco específico, el título puede ser dinámico (nombre del banco)
        const bankIdSegment = segments[2]
        if (bankIdSegment && !isNaN(Number(bankIdSegment))) {
          const selectedBank = banks.find((b) => b.id === Number(bankIdSegment))
          const base = buildHeaderConfigFromTab(bankTab)
          return overrideHeaderConfig(base, {
            title: selectedBank?.name || bankTab.headerTitle,
          })
        }
        return buildHeaderConfigFromTab(bankTab)
      }
      // Fallback: tab "all" o banco no encontrado
      const allTab = bankSubTabs.find((t) => t.value === "all")
      const subTab = allTab?.subTabs?.find((st) => st.value === (segments[3] || "overview"))
      if (subTab) return buildHeaderConfigFromTab(subTab)
      return buildHeaderConfigFromTab(allTab!)
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