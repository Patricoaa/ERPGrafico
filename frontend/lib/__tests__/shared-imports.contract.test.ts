import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

const FRONTEND_ROOT = process.cwd()
const SHARED_DIR = "components/shared"
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])

/**
 * Layer direction (invariantes 2/3): `components/shared` must never depend on
 * `features/*`. Shared is the lower layer; features import shared, never the
 * reverse. A shared file that reaches into a feature drags that feature's whole
 * dependency graph into every shared consumer and makes the barrel circular.
 *
 * T4 extracted the two offenders listed in the audit (§3.1):
 *   - `NumpadModal` promoted to `components/shared/NumpadModal.tsx`
 *     (was `features/pos/components/NumpadModal`, imported by shared).
 *   - `LedgerDrawer` bridge: `ReportTable` used to own the drawer; the click
 *     now surfaces through `onDrillDown` and the feature renders its drawer.
 * T5 relocated the whole `ProductSelector` grid family out of shared to
 * `components/selectors/ProductGridPicker` (its `@/features/inventory`
 * imports left the shared layer with it).
 *
 * Remaining ratchet (not covered by the audit, verified 2026-10-09): these two
 * files still reach into features and are NOT new violations. They cannot be
 * extracted without larger refactors, so they are allowlisted and must not grow.
 * Deleting an entry here is the migration itself.
 */
const FEATURE_IMPORT = /(?:from\s+['"]|import\(\s*['"])(@\/features\/|(?:\.\.\/)+features\/)/

const RESIDUAL_ALLOWLIST = [
    // useUniversalSearch is a feature hook (global Ctrl+K search); a shared
    // component reaching straight for it keeps shared dependant on search.
    "components/shared/UniversalSearch.tsx",
    // ContactCardGrid consumes the contacts search hook directly.
    "components/shared/ContactSelector/ContactCardGrid.tsx",
]

function collect(dir: string, out: string[] = []): string[] {
    const abs = join(FRONTEND_ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        const absEntry = join(FRONTEND_ROOT, rel)
        if (statSync(absEntry).isDirectory()) {
            collect(rel, out)
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
            out.push(rel)
        }
    }
    return out
}

const SHARED_FILES = collect(SHARED_DIR)

describe("components/shared must not import from features/*", () => {
    it("scans the shared layer", () => {
        expect(SHARED_FILES.length).toBeGreaterThan(50)
    })

    it("confines feature imports to the residual allowlist", () => {
        const allowset = new Set<string>(RESIDUAL_ALLOWLIST)
        const offenders = SHARED_FILES.filter(
            (rel) =>
                !allowset.has(rel) &&
                FEATURE_IMPORT.test(readFileSync(join(FRONTEND_ROOT, rel), "utf8")),
        )
        expect(offenders).toEqual([])
    })

    it("every allowlist entry still exists and still reaches into features", () => {
        for (const rel of RESIDUAL_ALLOWLIST) {
            const abs = join(FRONTEND_ROOT, rel)
            expect(existsSync(abs), `${rel} is missing`).toBe(true)
            expect(FEATURE_IMPORT.test(readFileSync(abs, "utf8")), `${rel} stopped importing features`).toBe(
                true,
            )
        }
    })

    it("T4/T5 artifacts are in their final places", () => {
        expect(existsSync(join(FRONTEND_ROOT, "components/shared/NumpadModal.tsx"))).toBe(true)
        expect(existsSync(join(FRONTEND_ROOT, "features/pos/components/NumpadModal.tsx"))).toBe(false)
        expect(existsSync(join(FRONTEND_ROOT, "components/selectors/ProductGridPicker/ProductGridPicker.tsx"))).toBe(true)
        expect(existsSync(join(FRONTEND_ROOT, "components/shared/ProductSelector"))).toBe(false)
        const folio = readFileSync(
            join(FRONTEND_ROOT, "components/shared/FolioValidationInput.tsx"),
            "utf8",
        )
        expect(folio).toContain('from "./NumpadModal"')
        const reportTable = readFileSync(
            join(FRONTEND_ROOT, "components/shared/ReportTable.tsx"),
            "utf8",
        )
        expect(reportTable).not.toContain("@/features/accounting")
        expect(reportTable).toContain("onDrillDown")
    })
})