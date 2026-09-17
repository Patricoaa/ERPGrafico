import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

const FRONTEND_ROOT = process.cwd()
const SCAN_DIRS = ["app", "components", "features", "hooks", "lib"]
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__", "e2e"])

const INK_UTILITY =
    /\b(?:bg|text|border|from|via|to|ring|fill|stroke|divide|outline|decoration|shadow|caret|accent)-(?:cyan|magenta|yellow)(?:\/\d+)?\b/

/**
 * Layer 1 inks (cyan/magenta/yellow) are reserved for categorical identity.
 * The ledger summary keeps them as a bounded carve-out (ADR-0071, §4.6): ink on
 * border/tint/icon, labels on `text-foreground`.
 */
const INK_ALLOWLIST = [
    "components/shared/Badge.tsx",
    "components/shared/DataTableCells.tsx",
    "components/shared/TabBar.tsx",
    "features/accounting/components/LedgerSummaryPanel.tsx",
    "features/pos/components/Cart.tsx",
    "features/pos/components/POSApprovalCard.tsx",
] as const

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    const abs = join(FRONTEND_ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        const absEntry = join(FRONTEND_ROOT, rel)
        if (statSync(absEntry).isDirectory()) {
            collectSourceFiles(rel, out)
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
            out.push(rel)
        }
    }
    return out
}

const SOURCE_FILES = SCAN_DIRS.flatMap((dir) => collectSourceFiles(dir))

describe("Layer 1 ink usage (semantic surfaces)", () => {
    it("scans a non-empty source set", () => {
        expect(SOURCE_FILES.length).toBeGreaterThan(100)
    })

    it("confines raw cyan/magenta/yellow utilities to the documented allowlist", () => {
        const allowset = new Set<string>(INK_ALLOWLIST)
        const offenders = SOURCE_FILES.filter((rel) => {
            if (allowset.has(rel)) return false
            return INK_UTILITY.test(readFileSync(join(FRONTEND_ROOT, rel), "utf8"))
        })
        expect(offenders).toEqual([])
    })

    it("every allowlist entry still exists", () => {
        for (const rel of INK_ALLOWLIST) {
            expect(existsSync(join(FRONTEND_ROOT, rel)), `${rel} is missing`).toBe(true)
        }
    })

    it("ledger carve-out keeps ink off label text", () => {
        const src = readFileSync(
            join(FRONTEND_ROOT, "features/accounting/components/LedgerSummaryPanel.tsx"),
            "utf8",
        )
        const inkTextUses = src.match(/\btext-(?:cyan|magenta|yellow)\b/g) ?? []
        // One ink-colored icon per inked figure (cyan, magenta, yellow) — never a label.
        expect(inkTextUses).toHaveLength(3)
        for (const label of ["Cargos (Debe)", "Abonos (Haber)", "Saldo Final"]) {
            expect(src).toContain(`text-foreground">${label}</p>`)
        }
    })

    it("carve-out is documented and gets an ADR", () => {
        const colorContract = readFileSync(
            join(FRONTEND_ROOT, "..", "docs/20-contracts/color-system.md"),
            "utf8",
        )
        expect(colorContract).toContain("Ledger Ink Metaphor")
        expect(colorContract).toContain("ADR-0071")
        expect(
            existsSync(
                join(FRONTEND_ROOT, "..", "docs/10-architecture/adr/0071-ledger-ink-metaphor-carveout.md"),
            ),
        ).toBe(true)
    })
})
