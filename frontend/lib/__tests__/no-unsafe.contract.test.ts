/**
 * `@typescript-eslint/no-unsafe-*` ratchet contract.
 *
 * The `no-unsafe-*` family (`no-unsafe-assignment`, `no-unsafe-call`,
 * `no-unsafe-member-access`, `no-unsafe-return`, `no-unsafe-function`) is
 * type-aware: it can only be computed by running ESLint, not by scanning file
 * text. The `zero-any-policy` (docs/90-governance/zero-any-policy.md) requires
 * these rules to eventually ship at `error`; eslint.config.mjs runs them at
 * `error` globally with a `warn` override for the legacy files pinned in
 * eslint-rules/no-unsafe-allowlist.mjs (which is the source of truth for
 * `NO_UNSAFE_BASELINE`).
 *
 * This test is the ratchet that keeps the migration one-directional. It runs
 * ESLint over the whole tree (cached — a warm run is a few seconds) and
 * asserts:
 *  - every file carrying a `no-unsafe-*` warning is listed in
 *    `NO_UNSAFE_BASELINE` (a new offender must be added to the baseline, and
 *    migration means deleting its file's entries from
 *    eslint-rules/no-unsafe-allowlist.mjs when the warnings are gone),
 *  - no baseline file has MORE warnings than its baseline count (growing a
 *    known offender back up is a regression),
 *  - the global total never exceeds the baseline total,
 *  - every baseline entry still exists and still actually has a warning
 *    (stale entries must be removed once a file is migrated).
 *
 * Migrating a file = fixing all of its `no-unsafe-*` warnings and deleting
 * its entries from `NO_UNSAFE_BASELINE` in eslint-rules/no-unsafe-allowlist.mjs
 * in this same change.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { ESLint } from "eslint"
import path from "node:path"
import { NO_UNSAFE_BASELINE } from "../../eslint-rules/no-unsafe-allowlist.mjs"

const FRONTEND_ROOT = process.cwd()

const BASELINE_TOTAL = Object.values(NO_UNSAFE_BASELINE).reduce((a, b) => a + b, 0)

const NO_UNSAFE_RULES = [
    "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/no-unsafe-call",
    "@typescript-eslint/no-unsafe-function",
    "@typescript-eslint/no-unsafe-member-access",
    "@typescript-eslint/no-unsafe-return",
]

let census: Map<string, number> = new Map()

async function runCensus(): Promise<Map<string, number>> {
    const eslint = new ESLint({ cache: true, cacheLocation: ".eslintcache" })
    const results = await eslint.lintFiles(["."])
    const perFile = new Map<string, number>()
    for (const r of results) {
        const count = r.messages.filter(
            (m) => m.ruleId && NO_UNSAFE_RULES.includes(m.ruleId),
        ).length
        if (count > 0) {
            perFile.set(path.relative(FRONTEND_ROOT, r.filePath), count)
        }
    }
    return perFile
}

describe("no-unsafe-* ratchet (type-aware eslint census)", () => {
    beforeAll(async () => {
        census = await runCensus()
    }, 300_000)

    it("scans a non-empty source set", () => {
        expect(census.size).toBeGreaterThan(0)
    })

    it("confines no-unsafe-* warnings to the baseline allowlist", () => {
        const baseline = new Set(Object.keys(NO_UNSAFE_BASELINE))
        const offenders = [...census.keys()].filter((rel) => !baseline.has(rel))
        expect(offenders).toEqual([])
    })

    it("no baseline file grows beyond its captured count", () => {
        const grown: string[] = []
        for (const [rel, count] of census) {
            const cap = NO_UNSAFE_BASELINE[rel]
            if (cap !== undefined && count > cap) grown.push(`${rel}: ${count} > ${cap}`)
        }
        expect(grown).toEqual([])
    })

    it("global no-unsafe-* total never exceeds the baseline total", () => {
        const total = [...census.values()].reduce((a, b) => a + b, 0)
        expect(total).toBeLessThanOrEqual(BASELINE_TOTAL)
    })

    it("every baseline entry still exists and still has at least one warning", () => {
        const stale: string[] = []
        for (const rel of Object.keys(NO_UNSAFE_BASELINE)) {
            const count = census.get(rel)
            if (count === undefined) stale.push(`${rel} (no warnings reported — delete this baseline entry)`)
        }
        expect(stale).toEqual([])
    })
})