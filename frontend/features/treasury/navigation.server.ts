/**
 * Server-side helpers for Treasury navigation metadata.
 * Used in Server Components to generate dynamic metadata based on bank data.
 */

import type { Metadata } from "next"
import { ALL_BANKS_SUB_VIEWS, BANK_SUB_VIEWS } from "./navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"
import { treasuryApi } from "./api/treasuryApi"

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
 * Metadata of a `/treasury/bank-center/<bankId>/<subView>` page, named after the bank.
 * Falls back to "Banco <id>" when the bank cannot be read.
 */
export async function buildBankPageMetadata(bankId: number, subView: string): Promise<Metadata> {
  try {
    const overview = await treasuryApi.getBankOverview(bankId)
    const bankName = (overview?.bank as { name?: string } | undefined)?.name || `Banco ${bankId}`
    return buildBankMetadata(bankName, subView)
  } catch {
    return buildBankMetadata(`Banco ${bankId}`, subView)
  }
}

/**
 * Build metadata for "Todos" (all banks) aggregated sub-views
 * (`/treasury/bank-center/<subView>`).
 */
export function buildAllBanksMetadata(subView: string): Metadata {
  const subViewConfig = ALL_BANKS_SUB_VIEWS.find((sv) => sv.value === subView)
  if (!subViewConfig) {
    return { title: "Centro de Bancos | ERPGrafico" }
  }

  return buildMetadataFromTab(subViewConfig)
}