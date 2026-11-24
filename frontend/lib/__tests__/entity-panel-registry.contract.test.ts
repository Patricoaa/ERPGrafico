import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { UNREGISTERED_PANEL_LABELS } from "./entity-panel-registry.legacy"

/**
 * ADR-0152: un registro = una pestaña por `openEntity`, así que toda entidad cuyo drawer de edición
 * se monta en la página con `<EntityPanelTab label="…">` (sin `variant`) debe estar en `ENTITY_DRAWERS`.
 *
 * `UNREGISTERED_PANEL_LABELS` es un ratchet: solo puede perder entradas (registrar el drawer y migrar
 * la vista de la oleada). Agregar una es romper el contrato.
 */

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])

function collect(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(ROOT, dir))) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx$/.test(entry) && !/\.(test|spec)\.tsx$/.test(entry)) out.push(rel)
    }
    return out
}

/** Etiquetas de `<EntityPanelTab label="…">` sin `variant` (los paneles con `variant` son acciones, no el registro). */
function panelLabels(): Map<string, string[]> {
    const found = new Map<string, string[]>()
    for (const dir of ["app", "features", "components"]) {
        for (const rel of collect(dir)) {
            const source = readFileSync(join(ROOT, rel), "utf8")
            for (const match of source.matchAll(/<EntityPanelTab\b/g)) {
                const rest = source.slice(match.index, match.index + 600)
                const tag = rest.split(/(?<!=)>/)[0]
                const label = tag.match(/\blabel="([^"]+)"/)?.[1]
                if (!label || /\bvariant=/.test(tag)) continue
                found.set(label, [...(found.get(label) ?? []), rel])
            }
        }
    }
    return found
}

const registered = (() => {
    const source = readFileSync(join(ROOT, "lib/entity-drawers.tsx"), "utf8")
    return new Set([...source.matchAll(/^\s*"([a-z_]+\.[a-z_]+)":/gm)].map((m) => m[1]))
})()

describe("entity panel ↔ drawer registry (ADR-0152)", () => {
    const labels = panelLabels()

    it("finds the page-mounted panels (guards the scanner itself)", () => {
        expect(labels.size).toBeGreaterThan(20)
        expect(labels.has("contacts.contact")).toBe(true)
    })

    it("every panel label is in ENTITY_DRAWERS unless it is on the shrinking allowlist", () => {
        const missing = [...labels.keys()].filter((l) => !registered.has(l) && !UNREGISTERED_PANEL_LABELS.includes(l)).sort()
        expect(missing, `Registra el drawer en lib/entity-drawers.tsx (no agregues a la allowlist): ${missing.join(", ")}`).toEqual([])
    })

    it("the allowlist only holds labels that are still unregistered and still used", () => {
        const stale = UNREGISTERED_PANEL_LABELS.filter((l) => registered.has(l) || !labels.has(l)).sort()
        expect(stale, `Quita de la allowlist (ya registradas o sin uso): ${stale.join(", ")}`).toEqual([])
    })
})
