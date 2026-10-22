/**
 * Helpers compartidos para leer configuración de navegación canónica.
 * Usados por Headers y Pages para obtener títulos consistentes.
 */

import type { NavTabConfig, FlatNavConfig } from "@/lib/navigation-types"
import type { Metadata } from "next"

/**
 * Busca un tab por su value en un array plano (incluye sub-tabs recursivamente)
 */
export function findTabConfig(
  tabs: NavTabConfig[],
  value: string
): NavTabConfig | undefined {
  for (const tab of tabs) {
    if (tab.value === value) return tab
    if (tab.subTabs) {
      const found = findTabConfig(tab.subTabs, value)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Busca un sub-tab: primero el parent, luego el sub dentro de parent.subTabs
 */
export function findSubTabConfig(
  tabs: NavTabConfig[],
  parentValue: string,
  subValue: string
): NavTabConfig | undefined {
  const parent = findTabConfig(tabs, parentValue)
  if (!parent?.subTabs) return undefined
  return findTabConfig(parent.subTabs, subValue)
}

/**
 * Construye objeto Metadata para Next.js desde NavTabConfig
 */
export function buildMetadataFromTab(config: NavTabConfig): Metadata {
  return {
    title: config.metadataTitle,
    description: config.headerDescription,
  }
}

/**
 * Construye configuración para PageHeader desde NavTabConfig
 */
export function buildHeaderConfigFromTab(config: NavTabConfig): {
  title: string
  description: string
  iconName: string
} {
  return {
    title: config.headerTitle,
    description: config.headerDescription,
    iconName: config.iconName,
  }
}

/**
 * Variante para configuración plana (sin tabs anidados)
 */
export function buildMetadataFromFlat(config: FlatNavConfig): Metadata {
  return {
    title: config.metadataTitle,
    description: config.headerDescription,
  }
}

export function buildHeaderConfigFromFlat(config: FlatNavConfig): {
  title: string
  description: string
  iconName: string
} {
  return {
    title: config.headerTitle,
    description: config.headerDescription,
    iconName: config.iconName,
  }
}

/**
 * Helper para páginas con títulos dinámicos (ej. bank name en BankPageHeader)
 * Permite override de title/description manteniendo iconName y metadata base
 */
export function overrideHeaderConfig(
  base: { title: string; description: string; iconName: string },
  overrides: Partial<{ title: string; description: string }>
): { title: string; description: string; iconName: string } {
  return {
    title: overrides.title ?? base.title,
    description: overrides.description ?? base.description,
    iconName: base.iconName,
  }
}

/**
 * Helper para metadata dinámica (ej. detail pages con nombre de entidad)
 */
export function overrideMetadata(
  base: Metadata,
  overrides: Partial<Metadata>
): Metadata {
  return {
    ...base,
    ...overrides,
  }
}