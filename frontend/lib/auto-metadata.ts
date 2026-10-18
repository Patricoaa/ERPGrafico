/**
 * AutoMetadata - Genera metadata SEO automáticamente desde navigation.ts canónico
 * Elimina drift: las pages no necesitan importar metadata manualmente
 * 
 * Uso en Server Component (layout.tsx o page.tsx):
 *   export const generateMetadata = createAutoMetadata("treasury")
 * 
 * O en page.tsx con params dinámicos:
 *   export const generateMetadata = createAutoMetadata("treasury", { dynamicParams: true })
 */

import type { Metadata } from "next"
import { findTabConfig, findSubTabConfig, buildMetadataFromTab } from "@/lib/navigation-helpers"
import type { NavTabConfig } from "@/lib/navigation-types"

// Cache de módulos cargados (evita re-imports)
const navigationCache = new Map<string, { TABS: NavTabConfig[] }>()

async function loadModuleNavigation(moduleKey: string): Promise<NavTabConfig[] | null> {
  if (navigationCache.has(moduleKey)) {
    return navigationCache.get(moduleKey)!.TABS
  }

  try {
    const moduleMap: Record<string, () => Promise<{ TABS: NavTabConfig[] }>> = {
      treasury: () => import("@/features/treasury/navigation").then(m => ({ TABS: m.TREASURY_TABS })),
      accounting: () => import("@/features/accounting/navigation").then(m => ({ TABS: m.ACCOUNTING_TABS })),
      sales: () => import("@/features/sales/navigation").then(m => ({ TABS: m.SALES_TABS })),
      purchasing: () => import("@/features/purchasing/navigation").then(m => ({ TABS: m.PURCHASING_TABS })),
      billing: () => import("@/features/billing/navigation").then(m => ({ TABS: m.BILLING_TABS })),
      hr: () => import("@/features/hr/navigation").then(m => ({ TABS: m.HR_TABS })),
      finances: () => import("@/features/finances/navigation").then(m => ({ TABS: m.FINANCES_TABS })),
      inventory: () => import("@/features/inventory/navigation").then(m => ({ TABS: m.INVENTORY_TABS })),
    }

    const loader = moduleMap[moduleKey]
    if (!loader) return null

    const { TABS } = await loader()
    navigationCache.set(moduleKey, { TABS })
    return TABS
  } catch {
    return null
  }
}

/**
 * Resuelve la config de metadata desde el pathname
 * pathname ej: "/treasury/operaciones/checks" → module="treasury", tabs=["operaciones", "checks"]
 */
export async function resolveMetadataFromPath(pathname: string): Promise<Metadata | null> {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null

  const moduleKey = segments[0]
  const TABS = await loadModuleNavigation(moduleKey)
  if (!TABS) return null

  // Nivel 1: tab principal
  const tab1Value = segments[1] || TABS[0]?.value
  const tab1 = findTabConfig(TABS, tab1Value)
  if (!tab1) return buildMetadataFromTab(TABS[0])

  // Si no hay más segmentos, usar tab principal
  if (segments.length <= 2) {
    return buildMetadataFromTab(tab1)
  }

  // Nivel 2: sub-tab
  const tab2Value = segments[2]
  const tab2 = tab1.subTabs ? findTabConfig(tab1.subTabs, tab2Value) : null
  if (tab2) {
    return buildMetadataFromTab(tab2)
  }

  // Fallback: tab principal
  return buildMetadataFromTab(tab1)
}

/**
 * Factory para createAutoMetadata en layout.tsx/page.tsx
 * Uso: export const generateMetadata = createAutoMetadata("treasury")
 */
export function createAutoMetadata(moduleKey: string) {
  return async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
    const { slug } = await params
    const pathname = slug ? `/${moduleKey}/${slug.join("/")}` : `/${moduleKey}`
    return resolveMetadataFromPath(pathname) || { title: "ERPGrafico" }
  }
}

/**
 * Helper para pages con params dinámicos (ej: bank-center/[bankId]/overview)
 * Resuelve metadata base + permite override dinámico
 */
export async function resolveDynamicMetadata(
  pathname: string,
  dynamicOverrides: Record<string, () => Promise<{ title?: string; description?: string } | null>>
): Promise<Metadata> {
  const base = await resolveMetadataFromPath(pathname)
  
  // Aplicar overrides dinámicos si existen
  for (const [segmentKey, resolver] of Object.entries(dynamicOverrides)) {
    if (pathname.includes(segmentKey)) {
      try {
        const override = await resolver()
        if (override?.title) {
          return { ...base, title: override.title }
        }
      } catch {
        // Ignore override errors
      }
    }
  }
  
  return base || { title: "ERPGrafico" }
}