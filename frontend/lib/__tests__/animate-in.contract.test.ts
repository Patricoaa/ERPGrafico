import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

const FRONTEND_ROOT = process.cwd()
const SCAN_DIRS = ["app", "components", "features", "hooks", "lib"]
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__", "e2e"])

const ANIMATE_UTILITY = /\banimate-(?:in|out)\b/

/**
 * `FadeIn` is the sanctioned motion primitive (DESIGN.md §5). Inline
 * `animate-in` / `animate-out` utilities must not spread: they bypass the
 * reduced-motion guard and duplicate keyframe wiring.
 *
 * `components/ui/*` (shadcn primitives) use `data-[state=…]:animate-in` in
 * their own internals and are out of scope. The remaining entries are an
 * incremental ratchet: each one is a file that still animates inline and must
 * not grow — migrating a file means deleting its entry here.
 *
 * T2 migrated: PartnerContributionWizard, PartnerWithdrawalWizard,
 * StatementImportModal, SessionOpenModal, SessionCloseModal.
 */
const ANIMATE_ALLOWLIST = [
    "app/(dashboard)/DashboardPageClient.tsx",
    "app/login/page.tsx",
    "app/not-found.tsx",
    "components/layout/DashboardShell.tsx",
    "components/shared/ActionDock.tsx",
    "components/shared/CardSkeleton.tsx",
    "components/shared/CollapsibleSheet.tsx",
    "components/shared/CommentSystem.tsx",
    "components/shared/DataTableCells.tsx",
    "components/shared/DataTable.tsx",
    "components/shared/DocumentAttachmentDropzone.tsx",
    "components/shared/EmptyState.tsx",
    "components/shared/EntityCard.tsx",
    "components/shared/ErrorBoundary.tsx",
    "components/shared/GenericWizard.tsx",
    "components/shared/LabeledContainer.tsx",
    "components/shared/LabeledInput.tsx",
    "components/shared/LabeledSelect.tsx",
    "components/shared/LayoutSkeletons.tsx",
    "components/shared/manufacturing/ManufacturingSpecsEditor.tsx",
    "components/shared/MultiSelectTagInput.tsx",
    "components/shared/MultiTagInput.tsx",
    "components/shared/PageContainer.tsx",
    "components/shared/SkeletonShell.tsx",
    "components/shared/WizardStepsSidebar.tsx",
    "features/accounting/components/closures/FiscalYearClosingWizard.tsx",
    "features/accounting/components/closures/NewFiscalYearDrawer.tsx",
    "features/auth/components/LoginForm.tsx",
    "features/billing/components/checkout/NoteItemsSummary.tsx",
    "features/billing/components/checkout/Step2_Logistics.tsx",
    "features/billing/components/checkout/Step3_Registration.tsx",
    "features/billing/components/checkout/Step4_Payment.tsx",
    "features/credits/components/CreditAssignmentModal.tsx",
    "features/finance/bank-reconciliation/components/ImportPreviewStep.tsx",
    "features/finance/bank-reconciliation/components/ReconciliationIntelligencePanel.tsx",
    "features/finance/components/CashFlowTable.tsx",
    "features/hr/components/EmployeeDrawer.tsx",
    "features/inventory/components/CategoryDrawer.tsx",
    "features/inventory/components/InventoryCountClientView.tsx",
    "features/inventory/components/product/BulkVariantEditForm.tsx",
    "features/inventory/components/ProductDrawer.tsx",
    "features/inventory/components/product/ProductInventoryTab.tsx",
    "features/inventory/components/product/ProductManufacturingTab.tsx",
    "features/inventory/components/product/ProductPricingSection.tsx",
    "features/inventory/components/product/ProductSubscriptionTab.tsx",
    "features/inventory/components/product/ProductVariantsTab.tsx",
    "features/inventory/components/product/VariantQuickEditForm.tsx",
    "features/inventory/components/UoMDrawer.tsx",
    "features/notes/components/steps/NoteStep_LineItems.tsx",
    "features/notes/components/steps/NoteStep_Payment.tsx",
    "features/notes/components/steps/NoteStep_Registration.tsx",
    "features/notes/components/steps/NoteStep_Review.tsx",
    "features/notes/components/steps/NoteStep_TypeSelector.tsx",
    "features/pos/components/Cart.tsx",
    "features/pos/components/POSCheckoutHeader.tsx",
    "features/pos/components/POSClientView.tsx",
    "features/pos/components/POSReport.tsx",
    "features/pos/components/SalesOrdersDrawer.tsx",
    "features/pos/components/ScannerFeedback.tsx",
    "features/pos/components/SessionControl.tsx",
    "features/pos/components/skeletons/POSLayoutSkeleton.tsx",
    "features/production/components/BOMDrawer.tsx",
    "features/production/components/BOMManager.tsx",
    "features/production/components/forms/WorkOrderBasicStep/index.tsx",
    "features/production/components/forms/WorkOrderBasicStep/OtTypeChooser.tsx",
    "features/production/components/forms/WorkOrderBasicStep/WorkOrderBasicInfo.tsx",
    "features/production/components/MaterialAssignmentTabs.tsx",
    "features/production/components/ProductionMetricsCard.tsx",
    "features/production/components/shared/OutsourcedServiceForm.tsx",
    "features/production/components/steps/FinishedStep.tsx",
    "features/production/components/steps/MaterialAssignmentStep.tsx",
    "features/production/components/WorkOrderWizard.tsx",
    "features/purchasing/components/checkout/PurchaseOrderSummaryCard.tsx",
    "features/purchasing/components/checkout/Step0_Supplier.tsx",
    "features/purchasing/components/checkout/Step2_PurchaseDTE.tsx",
    "features/purchasing/components/checkout/Step4_Receipt.tsx",
    "features/purchasing/components/DocumentRegistrationModal.tsx",
    "features/sales/components/checkout/OrderSummaryCard.tsx",
    "features/sales/components/checkout/Step2_DTE.tsx",
    "features/sales/components/checkout/Step3_Delivery.tsx",
    "features/sales/components/forms/AdvancedManufacturingDrawer.tsx",
    "features/sales/components/POSSessionsClientView.tsx",
    "features/settings/components/partners/PartnerLedgerDrawer.tsx",
    "features/tax/components/DeclarationWizard.tsx",
    "features/treasury/components/MonthlyInvoiceModal.tsx",
    "features/treasury/components/PaymentMethodSelector.tsx",
    "features/treasury/components/TerminalBatchSelectionModal.tsx",
    "features/treasury/components/TransferDrawer.tsx",
    "features/treasury/components/TreasuryAccountDrawer.tsx",
    "features/workflow/components/TaskActionCard.tsx",
    "features/workflow/components/TaskInbox.tsx",
] as const

/** Files migrated in T2 — inline animation must never come back. */
const MIGRATED_FILES = [
    "features/finance/bank-reconciliation/components/StatementImportModal.tsx",
    "features/pos/components/SessionCloseModal.tsx",
    "features/pos/components/SessionOpenModal.tsx",
    "features/settings/components/partners/PartnerContributionWizard.tsx",
    "features/settings/components/partners/PartnerWithdrawalWizard.tsx",
] as const

const FADE_IN = "components/shared/FadeIn.tsx"

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    const abs = join(FRONTEND_ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (rel === "components/ui") continue
        const absEntry = join(FRONTEND_ROOT, rel)
        if (statSync(absEntry).isDirectory()) {
            collectSourceFiles(rel, out)
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && rel !== FADE_IN) {
            out.push(rel)
        }
    }
    return out
}

const SOURCE_FILES = SCAN_DIRS.flatMap((dir) => collectSourceFiles(dir))

describe("Inline animation usage (FadeIn is the only motion primitive)", () => {
    it("scans a non-empty source set", () => {
        expect(SOURCE_FILES.length).toBeGreaterThan(100)
    })

    it("confines inline animate-in/animate-out to the ratchet allowlist", () => {
        const allowset = new Set<string>(ANIMATE_ALLOWLIST)
        const offenders = SOURCE_FILES.filter((rel) => {
            if (allowset.has(rel)) return false
            return ANIMATE_UTILITY.test(readFileSync(join(FRONTEND_ROOT, rel), "utf8"))
        })
        expect(offenders).toEqual([])
    })

    it("every allowlist entry still exists and still animates inline", () => {
        for (const rel of ANIMATE_ALLOWLIST) {
            const abs = join(FRONTEND_ROOT, rel)
            expect(existsSync(abs), `${rel} is missing`).toBe(true)
            expect(ANIMATE_UTILITY.test(readFileSync(abs, "utf8")), `${rel} no longer animates`).toBe(
                true,
            )
        }
    })

    it("T2-migrated files carry no inline animation and are not allowlisted", () => {
        const allowset = new Set<string>(ANIMATE_ALLOWLIST)
        for (const rel of MIGRATED_FILES) {
            expect(allowset.has(rel), `${rel} must not be allowlisted`).toBe(false)
            const src = readFileSync(join(FRONTEND_ROOT, rel), "utf8")
            expect(ANIMATE_UTILITY.test(src), `${rel} animates inline`).toBe(false)
            expect(src).toContain("<FadeIn")
        }
    })

    it("FadeIn owns the sanctioned animate-in mechanism", () => {
        const src = readFileSync(join(FRONTEND_ROOT, FADE_IN), "utf8")
        expect(ANIMATE_UTILITY.test(src)).toBe(true)
        expect(src).toContain("motion-reduce:animate-none")
    })
})
