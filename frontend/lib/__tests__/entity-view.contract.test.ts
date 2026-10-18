import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { LEGACY_CONSUMERS } from "./entity-view.legacy-consumers"

/**
 * Entity view system contract (ADR-0087 §9, docs/20-contracts/component-entity-view.md §9).
 *
 * Mechanical guards that keep the new system small and the legacy system frozen while
 * both coexist (Phase 7 strangler). ESLint (`eslint-rules/entity-view-guards.mjs`) covers
 * per-file patterns; this test covers the repo-wide ratchets ESLint cannot express.
 *
 * Every allowlist below is a ratchet: entries may only be removed (that removal IS the
 * migration), never added.
 */

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])

function collect(dir: string, out: string[] = []): string[] {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(rel)
    }
    return out
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8")

/** Members of a top-level `interface Name … { … }` block (same indentation as its first member). */
function interfaceMembers(source: string, name: string): string[] {
    const lines = source.split("\n")
    const start = lines.findIndex((l) => new RegExp(`^(export )?interface ${name}\\b`).test(l))
    if (start < 0) throw new Error(`interface ${name} not found`)
    let open = start
    while (!lines[open].includes("{")) open++
    const members: string[] = []
    let indent: string | null = null
    for (let i = open + 1; i < lines.length && !/^}/.test(lines[i]); i++) {
        const m = /^(\s+)(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:/.exec(lines[i])
        if (!m) continue
        indent ??= m[1]
        if (m[1] === indent) members.push(m[2])
    }
    return members
}

// ─── New system: small core ──────────────────────────────────────────────────

/** Gate B: at most 12 props per core component (anti-goal 1: no new 57-prop monolith). */
const PROP_CEILING = 12
const SURFACE_FILES = collect("components/entity-view/surfaces")

/**
 * Core value kinds. A kind enters the core only when ≥3 entities from ≥2 features use it
 * (Gate B); otherwise it is a feature extension (module augmentation + self-registering
 * builder). Adding a name here requires that evidence in the PR.
 */
const CORE_KINDS = [
    "text", "code", "number", "quantity", "money", "flow", "date", "dateRange",
    "status", "hubStatus", "contact", "tags", "progress",
]

describe("entity-view core stays small", () => {
    it("scans the surfaces", () => {
        expect(SURFACE_FILES.length).toBeGreaterThanOrEqual(4)
    })

    it(`every exported *Props interface has ≤ ${PROP_CEILING} props`, () => {
        const over: string[] = []
        for (const rel of SURFACE_FILES) {
            const source = read(rel)
            for (const [, name] of source.matchAll(/^export interface (\w+Props)\b/gm)) {
                const count = interfaceMembers(source, name).length
                if (count > PROP_CEILING) over.push(`${rel} ${name}: ${count}`)
            }
        }
        expect(over).toEqual([])
    })

    it("the core value-kind set changes only with governance evidence", () => {
        const kinds = interfaceMembers(read("components/entity-view/core/value-kinds.ts"), "ValueKinds")
        expect(kinds).toEqual(CORE_KINDS)
    })
})

// ─── Barrel evaluation order (import cycle guard) ────────────────────────────

/**
 * `@/components/shared` → GlobalModalProvider → drawer registry → feature views → this barrel is a
 * cycle at import time. Feature modules define entities and register kinds at module level, so the
 * dependency-free core must be evaluated before anything that imports shared (lote 2a: an import
 * re-sort here broke every entity-view test with "registerValueKind is not a function").
 */
describe("entity-view barrel evaluation order", () => {
    const firstIndex = (lines: string[], re: RegExp) => lines.findIndex((l) => re.test(l))

    it("index.ts exports the core before importing kinds or surfaces", () => {
        const lines = read("components/entity-view/index.ts").split("\n")
        const lastCore = Math.max(...lines.map((l, i) => (/from "\.\/core\//.test(l) ? i : -1)))
        expect(lastCore).toBeGreaterThan(-1)
        expect(firstIndex(lines, /from "\.\/kinds\//)).toBeGreaterThan(lastCore)
        expect(firstIndex(lines, /from "\.\/surfaces\//)).toBeGreaterThan(lastCore)
    })

    it("core-kinds imports the core before @/components/shared", () => {
        const lines = read("components/entity-view/kinds/core-kinds.tsx").split("\n")
        const lastCore = Math.max(...lines.map((l, i) => (/from "\.\.\/core\//.test(l) ? i : -1)))
        expect(firstIndex(lines, /from "@\/components\/shared"/)).toBeGreaterThan(lastCore)
    })
})

// ─── Entity definitions: no opaque escapes ───────────────────────────────────

const FEATURE_FILES = collect("features")
const ENTITY_FILES = FEATURE_FILES.filter((rel) => /\/entity-view\/[^/]+\.entity\.tsx?$/.test(rel))

/** Cast debt inside entity definitions. Emptied by R5 (typed getHubStatuses); must stay empty. */
const ENTITY_CAST_ALLOWLIST: string[] = []

describe("extension builders used across features (lote 3a)", () => {
    it("docRef is the first export of @/features/documents and has no runtime imports", () => {
        const barrel = read("features/documents/index.ts").split("\n").filter((l) => /^(export|import)\b/.test(l))
        expect(barrel[0]).toMatch(/^export \{ docRef\b.*from '\.\/entity-view\/docRef'/)
        const runtimeImports = read("features/documents/entity-view/docRef.ts").split("\n").filter((l) => /^import\b/.test(l) && !/^import type\b/.test(l))
        expect(runtimeImports).toEqual([])
    })
})

describe("entity definitions", () => {
    it("live in features/<feature>/entity-view/<entity>.entity.ts(x)", () => {
        const misplaced = [...FEATURE_FILES, ...collect("app"), ...collect("components/shared")].filter(
            (rel) => /\bdefineEntity<\w/.test(read(rel)) && !ENTITY_FILES.includes(rel) && !/\.stories\.tsx?$/.test(rel),
        )
        expect(ENTITY_FILES.length).toBeGreaterThanOrEqual(1)
        expect(misplaced).toEqual([])
    })

    it("carry no untyped escapes (as any / as unknown as / : any)", () => {
        const offenders = ENTITY_FILES.filter(
            (rel) => !ENTITY_CAST_ALLOWLIST.includes(rel) && /\bas any\b|\bas unknown as\b|:\s*any\b/.test(read(rel)),
        )
        expect(offenders).toEqual([])
    })

    it("cast allowlist entries still exist and still carry the cast", () => {
        for (const rel of ENTITY_CAST_ALLOWLIST) {
            expect(existsSync(join(ROOT, rel)), `${rel} is missing`).toBe(true)
            expect(/\bas unknown as\b/.test(read(rel)), `${rel} no longer casts — remove it from the allowlist`).toBe(true)
        }
    })
})

// ─── Legacy system: frozen ───────────────────────────────────────────────────

/**
 * Props-compat freeze (reused from ADR-0078, superseded by ADR-0087): the legacy authoring
 * API may shrink as entities migrate, never grow. Lower a number when a prop is removed.
 */
const LEGACY_CEILINGS: { file: string; name: string; max: number }[] = [
    { file: "components/shared/DataTable.tsx", name: "DataTableProps", max: 57 },
    { file: "components/shared/DataTableView.tsx", name: "DataTableViewProps", max: 12 },
    { file: "components/shared/AutoEntityCard.tsx", name: "AutoEntityCardProps", max: 22 },
]
const LEGACY_FIELD_TYPES = 15

/**
 * Hand-written tables in features (`<table>` or the `ui/table` primitive), measured
 * 2026-10-17. Wizard/modal batch editing (P1/P2) migrates to `EditableCollection`;
 * reports and trees are specific cases (feature-owned surfaces). The list only shrinks.
 */
const ADHOC_TABLE_ALLOWLIST = [
    "features/billing/components/checkout/Step1_Items.tsx",
    "features/billing/components/checkout/Step2_Logistics.tsx",
    "features/credits/components/BlacklistClientView.tsx",
    "features/finance/bank-reconciliation/components/SplitAllocationDialog.tsx",
    "features/finance/components/BudgetVarianceTable.tsx",
    "features/finance/components/CashFlowTable.tsx",
    "features/hr/components/PayrollCard.tsx",
    "features/inventory/components/product/ProductManufacturingTab.tsx",
    "features/inventory/components/product/ProductPricingTab.tsx",
    "features/inventory/components/product/ProductVariantsTab.tsx",
    "features/orders/components/NoteLogisticsModal.tsx",
    "features/production/components/BOMDrawer.tsx",
    "features/production/components/WorkOrderWizard.tsx",
    "features/purchasing/components/checkout/Step1_ProductSelection.tsx",
    "features/purchasing/components/checkout/Step4_Receipt.tsx",
    "features/purchasing/components/PurchaseOrderModal.tsx",
    "features/sales/components/checkout/Step3_Delivery.tsx",
    "features/settings/components/partners/CreateDistributionFlow.tsx",
    "features/settings/components/partners/MassPaymentWizard.tsx",
    "features/settings/components/partners/MobilizeEarningsWizard.tsx",
    "features/treasury/card-statements/BillChargesModal.tsx",
]
const ADHOC_TABLE = /<table[\s>/]|from ["']@\/components\/ui\/table["']/

/** Legacy authoring API in use (M8). The legacy system itself and its replacement are out of scope. */
const LEGACY_USE = /toColumns\(|AutoEntityCard|<DataTable\b|DataTableView|createEntityFields/
const legacyScope = () =>
    [...FEATURE_FILES, ...collect("app"), ...collect("components")].filter(
        (rel) => !/^components\/(shared|entity-view|ui)\//.test(rel) && !/\.stories\.tsx$/.test(rel),
    )

describe("legacy presentation system is frozen", () => {
    it.each(LEGACY_CEILINGS)("$name has at most $max props", ({ file, name, max }) => {
        expect(interfaceMembers(read(file), name).length).toBeLessThanOrEqual(max)
    })

    it(`FieldType gains no new member (≤ ${LEGACY_FIELD_TYPES})`, () => {
        const source = read("components/shared/entity-fields.tsx")
        const block = /type FieldType =([\s\S]*?)\n\n/.exec(source)?.[1] ?? ""
        expect((block.match(/\|\s*"[\w-]+"/g) ?? []).length).toBeLessThanOrEqual(LEGACY_FIELD_TYPES)
    })

    it("no new hand-written table appears in features or app", () => {
        const allow = new Set(ADHOC_TABLE_ALLOWLIST)
        const offenders = [...FEATURE_FILES, ...collect("app")].filter(
            (rel) => rel.endsWith(".tsx") && !allow.has(rel) && !/\.stories\.tsx$/.test(rel) && ADHOC_TABLE.test(read(rel)),
        )
        expect(offenders).toEqual([])
    })

    it("ad hoc table allowlist entries still exist and still hold a table", () => {
        for (const rel of ADHOC_TABLE_ALLOWLIST) {
            expect(existsSync(join(ROOT, rel)), `${rel} is missing — remove it from the allowlist`).toBe(true)
            expect(ADHOC_TABLE.test(read(rel)), `${rel} no longer holds a table — remove it from the allowlist`).toBe(true)
        }
    })

    it("no new file consumes the legacy system", () => {
        const allow = new Set(LEGACY_CONSUMERS)
        const offenders = legacyScope().filter((rel) => !allow.has(rel) && LEGACY_USE.test(read(rel)))
        expect(offenders).toEqual([])
    })

    it("legacy consumer entries still exist and still use the legacy system", () => {
        for (const rel of LEGACY_CONSUMERS) {
            expect(existsSync(join(ROOT, rel)), `${rel} is missing — remove it from LEGACY_CONSUMERS`).toBe(true)
            expect(LEGACY_USE.test(read(rel)), `${rel} migrated — remove it from LEGACY_CONSUMERS`).toBe(true)
        }
    })
})
