import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Riel de herramientas (spec 2026-11-27): bandeja y calculadora son overlays bloqueantes en z 110,
 * por encima del ActionDock (z 100). Mientras uno está abierto, las capas flotantes que se abren
 * desde su interior deben quedar encima, y solo entonces el riel recupera los clics.
 */
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8")

function ruleBody(selectorFragment: string): string {
    const i = css.indexOf(selectorFragment)
    expect(i, `no se encontró una regla con ${selectorFragment}`).toBeGreaterThan(-1)
    return css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i))
}

describe("capas sobre los overlays del riel", () => {
    it("selects, menús, popovers y tooltips se elevan sobre el overlay del riel", () => {
        const body = ruleBody('body:has([data-slot="sheet-overlay"].rail-overlay) :is(')
        const z = Number(/z-index:\s*(\d+)/.exec(body)?.[1])
        expect(z).toBeGreaterThan(110)
        const selector = css.slice(css.indexOf('body:has([data-slot="sheet-overlay"].rail-overlay) :is('), css.indexOf("{", css.indexOf('body:has([data-slot="sheet-overlay"].rail-overlay) :is(')))
        for (const slot of ["select-content", "dropdown-menu-content", "dropdown-menu-sub-content", "popover-content", "tooltip-content"]) {
            expect(selector).toContain(`[data-slot="${slot}"]`)
        }
    })

    it("el riel solo recupera los clics mientras hay un overlay del riel", () => {
        const body = ruleBody('body:has([data-slot="sheet-overlay"].rail-overlay) [data-tool-rail]')
        expect(body).toMatch(/pointer-events:\s*auto/)
    })
})
