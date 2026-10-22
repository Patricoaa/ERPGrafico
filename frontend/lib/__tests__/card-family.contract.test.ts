import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * Card family ratchet (ADR-0097, docs/20-contracts/component-card-family.md §5).
 *
 * Guards against hand-rolled card surfaces. A string literal that carries a border, a rounded-*
 * radius AND `bg-card` is a card surface reimplemented by hand: it should be one of the roles of
 * the family (`CardSurface`, `card-flat`/`surface-item`, `card-base`/`surface-panel`, `StatCard`,
 * `EntityCard`) so radius, border, hover and selection stay one decision.
 *
 *  - A file that is not in `card-family.baseline.json` may not introduce one.
 *  - A baseline file may not grow; when it shrinks the baseline must shrink with it
 *    (`CARD_FAMILY_BASELINE=1 npx vitest run lib/__tests__/card-family.contract.test.ts`).
 *  - Entries whose file disappeared or no longer matches are stale and must be removed.
 *  - A legitimate exception (a printed receipt, a login shell…) is marked with a
 *    `card-family-allow: <reason>` comment on the same line or the line above.
 *
 * Inputs (any `h-N` height token) and `bg-background` surfaces are not cards and are ignored.
 */

const ROOT = process.cwd()
const BASELINE_FILE = "lib/__tests__/card-family.baseline.json"
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])
const SCOPE = ["app", "features", "components"]

function collect(dir: string, out: string[] = []): string[] {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx$/.test(entry) && !/\.(test|spec|stories)\.tsx$/.test(entry)) out.push(rel)
    }
    return out
}

const FILES = SCOPE.flatMap((d) => collect(d)).filter((rel) => !rel.startsWith("components/ui/"))
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8")

const STRING_LITERAL = /"([^"\n]*)"|`([^`\n]*)`|'([^'\n]*)'/g

/** True when the class list rebuilds a card surface by hand. */
export function isHandRolledCard(classList: string): boolean {
    const tokens = classList.split(/\s+/).filter(Boolean)
    const border = tokens.some((t) => t === "border" || t.startsWith("border-border"))
    const radius = tokens.some((t) => /^rounded-(sm|md|lg|xl)$/.test(t))
    const surface = tokens.some((t) => t === "bg-card" || t.startsWith("bg-card/"))
    const control = tokens.some((t) => /^h-\d+$/.test(t))
    return border && radius && surface && !control
}

/** Count of hand-rolled card literals in a file, ignoring `card-family-allow` lines. */
export function countHandRolledCards(source: string): number {
    const lines = source.split("\n")
    let count = 0
    lines.forEach((line, i) => {
        if (/card-family-allow/.test(line) || (i > 0 && /card-family-allow/.test(lines[i - 1]))) return
        for (const m of line.matchAll(STRING_LITERAL)) {
            if (isHandRolledCard(m[1] ?? m[2] ?? m[3] ?? "")) count++
        }
    })
    return count
}

/** shadcn `Card` carries py-6/gap-6/shadow-card that custom utilities cannot override (twMerge). */
const CARD_WITH_SURFACE_UTILITY = /<Card\b[^>]*?\bcard-(base|flat)\b/

const census = new Map<string, number>()
for (const rel of FILES) {
    const n = countHandRolledCards(read(rel))
    if (n > 0) census.set(rel, n)
}

if (process.env.CARD_FAMILY_BASELINE === "1") {
    const sorted = Object.fromEntries([...census].sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(join(ROOT, BASELINE_FILE), JSON.stringify(sorted, null, 2) + "\n")
}

const BASELINE = JSON.parse(read(BASELINE_FILE)) as Record<string, number>

describe("card family detector", () => {
    it("flags a hand-rolled card surface", () => {
        expect(isHandRolledCard("flex gap-3 p-4 rounded-md border bg-card")).toBe(true)
        expect(isHandRolledCard("rounded-sm border border-border/60 bg-card/50 p-3")).toBe(true)
    })

    it("ignores inputs, plain containers and the sanctioned utilities", () => {
        expect(isHandRolledCard("h-9 rounded-md border bg-card px-3")).toBe(false)
        expect(isHandRolledCard("rounded-md border bg-background p-4")).toBe(false)
        expect(isHandRolledCard("card-flat group flex items-center gap-3 p-3")).toBe(false)
        expect(isHandRolledCard("border-b bg-card p-4")).toBe(false)
    })

    it("honours card-family-allow on the line or the line above", () => {
        const cls = '"rounded-md border bg-card p-4"'
        expect(countHandRolledCards(`<div className=${cls} /> {/* card-family-allow: receipt */}`)).toBe(0)
        expect(countHandRolledCards(`{/* card-family-allow: receipt */}\n<div className=${cls} />`)).toBe(0)
        expect(countHandRolledCards(`<div className=${cls} />`)).toBe(1)
    })
})

describe("no new hand-rolled card surfaces", () => {
    it("scans a non-empty source set", () => {
        expect(FILES.length).toBeGreaterThan(100)
    })

    it("confines them to the baseline", () => {
        expect([...census.keys()].filter((rel) => !(rel in BASELINE))).toEqual([])
    })

    it("no baseline file has more than its captured count", () => {
        const grown = Object.entries(BASELINE).filter(([rel, max]) => (census.get(rel) ?? 0) > max).map(([rel]) => rel)
        expect(grown).toEqual([])
    })

    it("baseline entries are tight: migrated files are removed or lowered", () => {
        const stale = Object.entries(BASELINE)
            .filter(([rel, max]) => !existsSync(join(ROOT, rel)) || (census.get(rel) ?? 0) < max)
            .map(([rel]) => rel)
        expect(stale, "lower or remove these in card-family.baseline.json (CARD_FAMILY_BASELINE=1)").toEqual([])
    })
})

describe("shadcn Card is not styled with the surface utilities", () => {
    it("no <Card className=\"card-base|card-flat\"> — use CardSurface or <Card variant=\"flat\">", () => {
        const offenders = FILES.filter((rel) => CARD_WITH_SURFACE_UTILITY.test(read(rel)))
        expect(offenders).toEqual([])
    })
})
