import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { fadeInClass } from "../../components/shared/fade-in-class"

const FRONTEND_ROOT = process.cwd()
const SCAN_DIRS = ["app", "components", "features", "hooks", "lib"]
const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__", "e2e"])

const ANIMATE_UTILITY = /\banimate-(?:in|out)\b/

/**
 * `FadeIn` is the only motion primitive for entry animation (component-animation.md, ADR-0157).
 * Inline `animate-in` / `animate-out` utilities are banned outside it: whole sub-views use the
 * `<FadeIn>` wrapper and elements that cannot be wrapped use its class recipe `fadeInClass()`.
 * Both are reduced-motion aware and keep the keyframe wiring in one place.
 *
 * `components/ui/*` (shadcn primitives) use `data-[state=…]:animate-in` in their own internals
 * and are out of scope. The allowlist ratchet reached 0 in ADR-0157 and was removed.
 */
const MOTION_SOURCES = new Set(["components/shared/FadeIn.tsx", "components/shared/fade-in-class.ts"])

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    const abs = join(FRONTEND_ROOT, dir)
    if (!existsSync(abs)) return out
    for (const entry of readdirSync(abs)) {
        if (SKIP_DIRS.has(entry)) continue
        const rel = join(dir, entry)
        if (rel === "components/ui") continue
        const absEntry = join(FRONTEND_ROOT, rel)
        if (statSync(absEntry).isDirectory()) {
            collectSourceFiles(rel, out)
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !MOTION_SOURCES.has(rel)) {
            out.push(rel)
        }
    }
    return out
}

const SOURCE_FILES = SCAN_DIRS.flatMap((dir) => collectSourceFiles(dir))

describe("Inline animation usage (FadeIn is the only motion primitive)", () => {
    it("scans a non-empty source set", () => {
        expect(SOURCE_FILES.length).toBeGreaterThan(100)
    })

    it("no file outside FadeIn animates inline", () => {
        const offenders = SOURCE_FILES.filter((rel) => ANIMATE_UTILITY.test(readFileSync(join(FRONTEND_ROOT, rel), "utf8")))
        expect(offenders).toEqual([])
    })

    it("the class recipe is callable from Server Components (no \"use client\")", () => {
        const src = readFileSync(join(FRONTEND_ROOT, "components/shared/fade-in-class.ts"), "utf8")
        expect(/^\s*["']use client["']/.test(src)).toBe(false)
    })

    it("fadeInClass is always reduced-motion aware and fill-mode-both", () => {
        for (const cls of [fadeInClass(), fadeInClass({ from: "top", distance: 1, duration: 200 }), fadeInClass({ zoom: true, fade: false })]) {
            expect(cls).toContain("animate-in")
            expect(cls).toContain("fill-mode-both")
            expect(cls).toContain("motion-reduce:animate-none")
        }
    })

    it("fadeInClass maps options to literal utilities", () => {
        expect(fadeInClass({ from: "right", distance: 4, duration: 300 }).split(" ")).toEqual(
            expect.arrayContaining(["fade-in", "slide-in-from-right-4", "duration-300"]),
        )
        expect(fadeInClass({ zoom: true, fade: false })).not.toContain("fade-in")
        expect(fadeInClass({ zoom: true, fade: false })).toContain("zoom-in-95")
        expect(fadeInClass({ ease: "premium", delay: 200 })).toContain("ease-premium")
        expect(fadeInClass({ ease: "premium", delay: 200 })).toContain("delay-200")
    })
})
