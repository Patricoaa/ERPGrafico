"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useBanks } from "@/features/treasury"
import { useViewModePreference } from "@/hooks/useViewModePreference"
import {
  buildTreasuryTabs,
  buildBankSubTabs,
  getTreasuryTab,
  getOperacionesSubTab,
  getTerminalCobroSubTab,
  getBankSubView,
} from "@/features/treasury/navigation"
import { buildHeaderConfigFromTab, overrideHeaderConfig } from "@/lib/navigation-helpers"
import { getModuleHeaderConfig } from "@/lib/module-registry"

const TreasurySettingsModal = dynamic(
  () => import("@/features/treasury").then(m => ({ default: m.TreasurySettingsModal })),
  { ssr: false },
)

export function TreasuryHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { banks } = useBanks()
  const { getViewModeUrl } = useViewModePreference()
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get("modal") === "settings")
  const initialSection = searchParams.get("tab") || undefined

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
      if (!bankIdSegment) return "banks"
      return "all"
    }
    return undefined
  }, [activeValue, segments])

  const bankSubTabs = useMemo(() => buildBankSubTabs(banks), [banks])

  const moduleConfig = getModuleHeaderConfig("treasury")

  const tabs = useMemo(() => buildTreasuryTabs(banks), [banks])

  const navigation = {
    moduleName: moduleConfig?.moduleName ?? "Tesorería",
    moduleHref: moduleConfig?.moduleHref ?? getViewModeUrl("treasury.treasurymovement", "/treasury/operaciones/movements"),
    tabs,
    activeValue,
    subActiveValue,
  }

  const getHeaderConfig = () => {
    const mainTab = getTreasuryTab(activeValue)
    if (!mainTab) {
      return { title: moduleConfig?.headerTitle ?? "Tesorería", description: moduleConfig?.headerDescription ?? "", iconName: moduleConfig?.iconName ?? "banknote" as const }
    }

    if (activeValue === "operaciones" && subActiveValue) {
      const subTab = getOperacionesSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "terminal-cobro" && subActiveValue) {
      const subTab = getTerminalCobroSubTab(subActiveValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
    }

    if (activeValue === "bank-center" && subActiveValue) {
      const bankIdSegment = segments[2]
      const isBankRoute = !!bankIdSegment && !isNaN(Number(bankIdSegment))

      if (subActiveValue === "banks") {
        const banksTab = bankSubTabs.find((tab) => tab.value === "banks")
        if (banksTab) return buildHeaderConfigFromTab(banksTab)
      }

      const subViewValue = isBankRoute
        ? (segments[3] || "overview")
        : (segments[2] || "banks")
      const bankTab = getBankSubView(bankSubTabs, subActiveValue, subViewValue)
      if (bankTab) {
        if (isBankRoute) {
          const selectedBank = banks.find((b) => b.id === Number(bankIdSegment))
          const base = buildHeaderConfigFromTab(bankTab)
          return overrideHeaderConfig(base, {
            title: selectedBank?.name || bankTab.headerTitle,
          })
        }
        return buildHeaderConfigFromTab(bankTab)
      }
      const allTab = bankSubTabs.find((t) => t.value === "all")
      const subTab = allTab?.subTabs?.find((st) => st.value === subViewValue)
      if (subTab) return buildHeaderConfigFromTab(subTab)
      return buildHeaderConfigFromTab(allTab!)
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSettingsOpen(true)} title="Configuración de Tesorería">
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      {isSettingsOpen && (
        <TreasurySettingsModal onOpenChange={setIsSettingsOpen} initialSection={initialSection} />
      )}
    </>
  )
}
