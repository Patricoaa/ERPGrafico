import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, it, expect } from "vitest"
import { ENTITY_REGISTRY } from "../entity-registry"

/**
 * ADR-0080 (GAP-08): todo `detailUrlPattern` del registro de entidades apunta a una ruta
 * que existe en `app/` (la auditoría encontró 22 patrones a páginas inexistentes).
 */
const APP_DIR = join(__dirname, "..", "..", "app")

function collectRoutes(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) collectRoutes(full, out)
        else if (entry === "page.tsx") {
            const segments = relative(APP_DIR, dir).split(sep).filter((s) => s && !(s.startsWith("(") && s.endsWith(")")))
            out.push("/" + segments.join("/"))
        }
    }
    return out
}

function hasRoute(pattern: string, routes: string[]): boolean {
    const path = pattern.split("?")[0].replace(/\{[^}]+\}/g, "1")
    const segs = path.split("/").filter(Boolean)
    return routes.some((route) => {
        const rsegs = route.split("/").filter(Boolean)
        return rsegs.length === segs.length && rsegs.every((r, i) => r === segs[i] || r.startsWith("["))
    })
}

describe("ENTITY_REGISTRY detail routes", () => {
    it("every detailUrlPattern resolves to an existing page", () => {
        const routes = collectRoutes(APP_DIR)
        const broken = Object.values(ENTITY_REGISTRY)
            .filter((meta) => meta.detailUrlPattern && !hasRoute(meta.detailUrlPattern, routes))
            .map((meta) => `${meta.label} → ${meta.detailUrlPattern}`)
        expect(broken).toEqual([])
    })
})

/**
 * ADR-0087 lote 2 (TC-041): `listUrl` is a static list page. A literal segment must match a literal
 * route segment: `/inventory/products/units` used to "resolve" through `/inventory/products/[id]`.
 */
function hasStaticRoute(url: string, routes: string[]): boolean {
    const path = url.split("?")[0].replace(/\/+$/, "") || "/"
    return routes.includes(path)
}

/**
 * Ratchet: entries whose `listUrl` points to a page that does not exist (measured 2026-10-17, see the
 * issue linked in docs/50-audit/Tablascards/ledger.md TC-042). Fixing one = removing it from this list.
 */
const KNOWN_BROKEN_LIST_URLS: string[] = []

describe("ENTITY_REGISTRY list routes", () => {
    const routes = collectRoutes(APP_DIR)
    const broken = Object.values(ENTITY_REGISTRY)
        .filter((meta) => meta.listUrl && !hasStaticRoute(meta.listUrl, routes))
        .map((meta) => meta.label)

    it("no new listUrl points to a missing page", () => {
        expect(broken.filter((label) => !KNOWN_BROKEN_LIST_URLS.includes(label))).toEqual([])
    })

    it("every known-broken entry is still broken (remove fixed ones from the list)", () => {
        expect(KNOWN_BROKEN_LIST_URLS.filter((label) => !broken.includes(label))).toEqual([])
    })
})
