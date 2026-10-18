/**
 * Server-side helpers for Treasury navigation metadata.
 * Used in Server Components to generate dynamic metadata based on bank data.
 */

import type { Metadata } from "next"
import { BANK_SUB_VIEWS } from "./navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

/**
 * Build metadata for bank-center sub-pages.
 * Since we can't fetch bank name here (no DB access in this helper),
 * the page component should call this with the bank name.
 */
export function buildBankMetadata(
  bankName: string,
  subView: string = "overview"
): Metadata {
  const subViewConfig = BANK_SUB_VIEWS.find((sv) => sv.value === subView)
  if (!subViewConfig) {
    return { title: `${bankName} | ERPGrafico` }
  }

  const baseMetadata = buildMetadataFromTab({
    ...subViewConfig,
    headerTitle: `${bankName} - ${subViewConfig.headerTitle}`,
    headerDescription: subViewConfig.headerDescription,
    metadataTitle: `${bankName} - ${subViewConfig.headerTitle} | ERPGrafico`,
  })

  return baseMetadata
}

/**
 * Build metadata for "Todos" (all banks) view with specific sub-view.
 */
export function buildAllBanksMetadata(subView: string = "overview"): Metadata {
  const subViewConfig = BANK_SUB_VIEWS.find((sv) => sv.value === subView)
  if (!subViewConfig) {
    return { title: "Centro de Bancos | ERPGrafico" }
  }

  return buildMetadataFromTab({
    ...subViewConfig,
    headerTitle: subViewConfig.headerTitle,
    headerDescription: subViewConfig.headerDescription,
    metadataTitle: `${subViewConfig.headerTitle} | ERPGrafico`,
  })
}