import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.resolve(here, "../../app/globals.css"), "utf8")

describe("notched field legend layering", () => {
    it("keeps labels above rings with an opaque surface-matched background", () => {
        const legendRule = css.match(/^[ \t]{2}fieldset\.notched-field legend\s*\{([\s\S]*?)^[ \t]{2}\}/m)?.[1] ?? ""
        expect(legendRule).toContain("position: relative;")
        expect(legendRule).toContain("z-index: 1;")
        expect(legendRule).toContain("background-color: var(--notched-field-label-background, var(--background));")
        expect(/--notched-field-label-background:\s*var\(--card\)/.test(css)).toBe(true)
    })
})
