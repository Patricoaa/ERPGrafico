import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * Intent text contrast guard (docs/20-contracts/color-system.md, ADR-0149).
 *
 * `--success` / `--warning` are fill inks: as text they reach only ~3:1 / ~1.4:1 on a light surface.
 * Text must use `text-success-text` / `text-warning-text` (>= 4.5:1, lighter in `.dark`).
 *
 *  - `text-warning` is banned everywhere.
 *  - `text-success` is allowed only on lone icons, in the files below (3:1 is enough for non-text UI).
 *    The list only shrinks: migrate a file, remove it.
 */

const ROOT = process.cwd()
const SCOPE = ["app", "components", "features", "lib", "hooks"]
const SKIP = new Set(["node_modules", ".next", "__tests__"])

const SUCCESS_ICON_ALLOWLIST = [
    "app/(dashboard)/settings/SettingsPageClient.tsx",
    "components/shared/FolioValidationInput.tsx",
    "components/shared/ReportTable.tsx",
    "components/shared/Section/SectionChecklist.tsx",
    "components/shared/Section/SectionNote.tsx",
    "components/ui/alert.tsx",
    "features/accounting/components/closures/FiscalYearClosingWizard.tsx",
    "features/accounting/components/closures/NewFiscalYearWizard.tsx",
    "features/contacts/entity-view/contact.entity.tsx",
    "features/credits/components/CreditAssignmentModal.tsx",
    "features/finance/bank-reconciliation/components/AutoMatchProgressModal.tsx",
    "features/finance/bank-reconciliation/components/StatementImportModal.tsx",
    "features/finance/components/AccountingEquationCard.tsx",
    "features/inventory/components/product/VariantQuickEditForm.tsx",
    "features/partners/components/MassPaymentWizard.tsx",
    "features/tax/components/DeclarationWizard.tsx",
    "features/workflow/components/TaskActionCard.tsx",
    "features/workflow/components/WorkflowSettings.tsx",
]

const TOKEN = /(?<![\w-])(?:[\w[\]:&>*()=.-]+:)*text-(success|warning)(?:\/\d+)?(?![\w-])/g

function collect(dir: string, out: string[] = []): string[] {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx?$/.test(entry) && !/\.(test|spec|stories)\.tsx?$/.test(entry)) out.push(rel)
    }
    return out
}

export function intentTextUses(source: string): Array<"success" | "warning"> {
    return [...source.matchAll(TOKEN)].map((m) => m[1] as "success" | "warning")
}

const FILES = SCOPE.flatMap((d) => collect(d))
const uses = new Map(FILES.map((rel) => [rel, intentTextUses(readFileSync(join(ROOT, rel), "utf8"))]))

describe("intent text detector", () => {
    it("finds fill-ink text utilities and ignores the readable tokens", () => {
        expect(intentTextUses('className="text-success"')).toEqual(["success"])
        expect(intentTextUses('className="hover:text-warning/70"')).toEqual(["warning"])
        expect(intentTextUses('className="text-success-text text-warning-text text-success-foreground"')).toEqual([])
    })
})

describe("intent text contrast (>= 4.5:1)", () => {
    it("scans a non-empty source set", () => {
        expect(FILES.length).toBeGreaterThan(300)
    })

    it("never uses text-warning", () => {
        const offenders = FILES.filter((rel) => uses.get(rel)?.includes("warning"))
        expect(offenders, "use text-warning-text").toEqual([])
    })

    it("uses text-success only on allowlisted icon files", () => {
        const offenders = FILES.filter((rel) => uses.get(rel)?.includes("success") && !SUCCESS_ICON_ALLOWLIST.includes(rel))
        expect(offenders, "use text-success-text (or allowlist a lone icon)").toEqual([])
    })

    it("allowlist entries are tight", () => {
        const stale = SUCCESS_ICON_ALLOWLIST.filter((rel) => !uses.get(rel)?.includes("success"))
        expect(stale, "remove these from SUCCESS_ICON_ALLOWLIST").toEqual([])
    })
})
