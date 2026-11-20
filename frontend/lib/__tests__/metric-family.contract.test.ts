import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * Metric family guard (ADR-0149, docs/20-contracts/component-metric.md).
 *
 * `StatCard`, `KPIWrapper`, `KPIValue`, `DeltaBadge` and `SectionCard` were removed once every
 * consumer moved to `Metric` / `MetricStrip` / `ChartCard`. No file may bring them back.
 * Stories and tests are out of scope.
 */

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])
const SCOPE = ["app", "features", "components"]

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
const FILES = SCOPE.flatMap((d) => collect(d))

/** True when the source references one of the removed KPI components. Comments are ignored. */
export function usesRemovedKpiComponent(source: string): boolean {
    return /\b(StatCard|KPIWrapper|KPIValue|DeltaBadge|SectionCard)\b/.test(
        source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"),
    )
}

describe("removed KPI component detector", () => {
    it("flags usage and ignores comments", () => {
        expect(usesRemovedKpiComponent('import { StatCard } from "@/components/shared"')).toBe(true)
        expect(usesRemovedKpiComponent("<KPIWrapper tooltip=\"x\">")).toBe(true)
        expect(usesRemovedKpiComponent("<SectionCard title=\"x\" />")).toBe(true)
        expect(usesRemovedKpiComponent("// migrated from StatCard")).toBe(false)
        expect(usesRemovedKpiComponent("/* StatCard was removed */ const a = 1")).toBe(false)
        expect(usesRemovedKpiComponent("<Metric label=\"x\" value={1} />")).toBe(false)
    })
})

describe("no removed KPI components (ADR-0149)", () => {
    it("scans a non-empty source set", () => {
        expect(FILES.length).toBeGreaterThan(100)
    })

    it("no file uses StatCard, KPIWrapper, KPIValue, DeltaBadge or SectionCard", () => {
        const offenders = FILES.filter((rel) => usesRemovedKpiComponent(read(rel)))
        expect(offenders, "use Metric / MetricStrip / ChartCard instead").toEqual([])
    })
})
