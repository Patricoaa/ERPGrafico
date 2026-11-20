import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * Metric family ratchet (ADR-0149, docs/20-contracts/component-metric.md).
 *
 * `StatCard` is deprecated in favour of `Metric` / `MetricStrip` / `ChartCard`. While its consumers
 * migrate by waves, no NEW file may reference it:
 *
 *  - A file that is not in `metric-family.baseline.json` may not use `StatCard`.
 *  - When a file migrates, remove it from the baseline
 *    (`METRIC_FAMILY_BASELINE=1 npx vitest run lib/__tests__/metric-family.contract.test.ts`).
 *  - The baseline only shrinks. When it is empty, `StatCard`, `KPIWrapper` and `SectionCard` are deleted.
 *
 * Stories, tests and the deprecated components' own files are out of scope.
 */

const ROOT = process.cwd()
const BASELINE_FILE = "lib/__tests__/metric-family.baseline.json"
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])
const SCOPE = ["app", "features", "components"]
const OWN = new Set(["components/shared/StatCard.tsx"])

function collect(dir: string, out: string[] = []): string[] {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx?$/.test(entry) && !/\.(test|spec|stories)\.tsx?$/.test(entry)) out.push(rel)
    }
    return out
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8")
const FILES = SCOPE.flatMap((d) => collect(d)).filter((rel) => !OWN.has(rel))

/** True when the source references the deprecated `StatCard` component or its barrel re-export. */
export function usesStatCard(source: string): boolean {
    return /\bStatCard\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"))
}

const census = FILES.filter((rel) => usesStatCard(read(rel))).sort()

if (process.env.METRIC_FAMILY_BASELINE === "1") {
    writeFileSync(join(ROOT, BASELINE_FILE), JSON.stringify(census, null, 2) + "\n")
}

const BASELINE = JSON.parse(read(BASELINE_FILE)) as string[]

describe("metric family detector", () => {
    it("flags StatCard usage and ignores comments", () => {
        expect(usesStatCard('import { StatCard } from "@/components/shared"')).toBe(true)
        expect(usesStatCard("<StatCard label=\"x\" value={1} />")).toBe(true)
        expect(usesStatCard("// migrated from StatCard")).toBe(false)
        expect(usesStatCard("/* StatCard is deprecated */ const a = 1")).toBe(false)
        expect(usesStatCard("<Metric label=\"x\" value={1} />")).toBe(false)
    })
})

describe("no new StatCard consumers (ADR-0149)", () => {
    it("scans a non-empty source set", () => {
        expect(FILES.length).toBeGreaterThan(100)
    })

    it("confines StatCard to the baseline", () => {
        expect(census.filter((rel) => !BASELINE.includes(rel)), "use Metric / MetricStrip / ChartCard instead").toEqual([])
    })

    it("baseline entries are tight: migrated files are removed", () => {
        const stale = BASELINE.filter((rel) => !existsSync(join(ROOT, rel)) || !census.includes(rel))
        expect(stale, "remove these from metric-family.baseline.json (METRIC_FAMILY_BASELINE=1)").toEqual([])
    })
})
