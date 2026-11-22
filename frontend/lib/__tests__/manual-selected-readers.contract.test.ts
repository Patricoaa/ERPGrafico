import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

/**
 * ADR-0152: `?selected` es solo un enlace profundo que resuelve `useDeepLinkEntity`. Una vista nueva no
 * debe leerlo a mano (`searchParams.get("selected")`) para abrir un registro: usa `openEntity` en la fila
 * y `useDeepLinkEntity` para el enlace.
 *
 * `ALLOWED` es un ratchet: solo puede perder entradas. Son lecturas que no abren «la ficha de un registro»
 * (panel de acción, mesa de conciliación, bandeja de tareas) o que aún pasan por `?action=`.
 */
const ALLOWED = new Set([
    "features/workflow/components/TaskInbox.tsx",
    "features/finance/bank-reconciliation/components/StatementsClientView.tsx",
    "features/treasury/card-statements/CardStatementsClientView.tsx",
    "features/treasury/loans/LoansClientView.tsx",
    "features/treasury/checks/ChecksClientView.tsx",
    "features/purchasing/components/SubscriptionsClientView.tsx",
    "hooks/useEntityRouteActions.ts",
])

const ROOT = process.cwd()
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__"])

function collect(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(ROOT, dir))) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (statSync(join(ROOT, rel)).isDirectory()) collect(rel, out)
        else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(rel)
    }
    return out
}

function readers(): string[] {
    const found: string[] = []
    for (const dir of ["app", "features", "components", "hooks"]) {
        for (const rel of collect(dir)) {
            if (/\.get\(\s*["']selected["']\s*\)/.test(readFileSync(join(ROOT, rel), "utf8"))) found.push(rel)
        }
    }
    return found.sort()
}

describe("lecturas manuales de ?selected (ADR-0152)", () => {
    it("no aparecen lecturas nuevas fuera de la lista permitida", () => {
        expect(readers().filter(file => !ALLOWED.has(file))).toEqual([])
    })

    it("la lista permitida no conserva archivos que ya no leen ?selected", () => {
        const actual = new Set(readers())
        expect([...ALLOWED].filter(file => !actual.has(file))).toEqual([])
    })
})
