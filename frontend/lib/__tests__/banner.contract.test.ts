import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * Banner contract ratchet (docs/20-contracts/component-banner.md).
 *
 * Every notice, warning, error or success message in the product is a `<Banner>`:
 * one flat band, tone carried by the icon and a /5 background, no radius, no border.
 * The shadcn `Alert` is kept only as an internal primitive of `components/ui` and may
 * not be imported by features or shared components.
 *
 *  - `@/components/ui/alert` may only be imported inside `components/ui/`.
 *  - A legitimate exception is marked with a `banner-allow: <reason>` comment.
 *  - `InfoBlock` no longer exists: its role is `Banner`.
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
        else if (/\.(tsx|ts)$/.test(entry) && !/\.(test|spec|stories)\.tsx?$/.test(entry)) out.push(rel)
    }
    return out
}

const FILES = SCOPE.flatMap((d) => collect(d)).filter((rel) => !rel.startsWith("components/ui/"))
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8")

const UI_ALERT_IMPORT = /from\s+["']@\/components\/ui\/alert["']/

/** True when the source imports the shadcn `Alert` primitive (and does not opt out). */
export function importsUiAlert(source: string): boolean {
    if (!UI_ALERT_IMPORT.test(source)) return false
    return !/banner-allow/.test(source)
}

const offenders = FILES.filter((rel) => importsUiAlert(read(rel)))

describe("Banner contract", () => {
    it("detects direct imports of the shadcn Alert primitive", () => {
        expect(importsUiAlert('import { Alert } from "@/components/ui/alert"')).toBe(true)
        expect(importsUiAlert('import {\n    Alert,\n} from "@/components/ui/alert"')).toBe(true)
        expect(importsUiAlert('import { AlertDialog } from "@/components/ui/alert-dialog"')).toBe(false)
        expect(importsUiAlert('// banner-allow: caso legítimo\nimport { Alert } from "@/components/ui/alert"')).toBe(false)
        expect(importsUiAlert('import { Banner } from "@/components/shared"')).toBe(false)
    })

    it("no feature or shared component imports Alert directly", () => {
        const census = offenders.map((rel) => `  ${rel}`).join("\n")
        expect(offenders, `Usa <Banner> de @/components/shared:\n${census}`).toEqual([])
    })

    it("exports Banner from the shared barrel and no longer exports InfoBlock", () => {
        const barrel = read("components/shared/index.ts")
        expect(barrel).toMatch(/export \* from '\.\/Banner'/)
        expect(barrel).not.toMatch(/InfoBlock/)
        expect(existsSync(join(ROOT, "components/shared/InfoBlock.tsx"))).toBe(false)
    })
})
