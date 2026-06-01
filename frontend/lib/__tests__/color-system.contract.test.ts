/**
 * Color System contract test.
 *
 * Parses `app/globals.css` (and `lib/badge-resolvers.ts`) as text and enforces
 * the invariants in `docs/20-contracts/color-system.md`. Pure text parsing — no
 * app imports — so it stays fast and decoupled from the module graph.
 *
 * Guards against the drift this test was created to prevent (ADR 0029):
 *  - every semantic intent has a token + foreground token,
 *  - Layer 3 domain tokens exist,
 *  - every `--x-raw: var(--y-raw)` alias points at a defined raw,
 *  - Layer 1 inks are FIXED (not overridden in `.dark`) while Layer 2 intents
 *    ARE overridden in `.dark`,
 *  - the data-viz palette exists,
 *  - STATUS_MAP only emits known intents.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.resolve(here, '../../app/globals.css'), 'utf8');
const resolvers = readFileSync(path.resolve(here, '../badge-resolvers.ts'), 'utf8');

/** First brace-delimited body of a top-level selector (these blocks have no nested braces). */
function block(selector: RegExp): string {
  const m = css.match(selector);
  return m ? m[1] : '';
}
const rootBlock = block(/:root\s*\{([\s\S]*?)\n\s*\}/);
const darkBlock = block(/\.dark\s*\{([\s\S]*?)\n\s*\}/);

const definesVar = (haystack: string, token: string) =>
  new RegExp(`--${token}\\s*:`).test(haystack);
/** `--color-x` tokens live in `@theme inline`; search the whole file. */
const definesColor = (token: string) => definesVar(css, `color-${token}`);

const INTENTS = ['primary', 'info', 'success', 'warning', 'destructive', 'neutral'] as const;
const DOMAIN = ['income', 'expense', 'asset', 'liability'] as const;
// Layer 1 = fixed inks + overprints: must NOT be re-declared in `.dark`.
const LAYER1 = ['cyan', 'magenta', 'yellow', 'black', 'red', 'green', 'blue', 'pantone-orange', 'pantone-violet'] as const;
// Layer 2 intents that must carry an explicit dark value.
const LAYER2_ADAPTIVE = ['primary', 'info', 'success', 'warning', 'destructive'] as const;

describe('color-system contract', () => {
  it('sanity: parsed the :root and .dark blocks', () => {
    expect(rootBlock.length).toBeGreaterThan(100);
    expect(darkBlock.length).toBeGreaterThan(100);
  });

  it('every semantic intent exposes a --color-{intent} and --color-{intent}-foreground token', () => {
    for (const intent of INTENTS) {
      expect(definesColor(intent), `--color-${intent}`).toBe(true);
      expect(definesColor(`${intent}-foreground`), `--color-${intent}-foreground`).toBe(true);
    }
  });

  it('Layer 3 domain natures expose tokens', () => {
    for (const t of DOMAIN) {
      expect(definesColor(t), `--color-${t}`).toBe(true);
      expect(definesColor(`${t}-foreground`), `--color-${t}-foreground`).toBe(true);
    }
  });

  it('every alias `--x-raw: var(--y-raw)` points at a defined raw', () => {
    const aliasRe = /--([\w-]+)-raw\s*:\s*var\(--([\w-]+)-raw\)/g;
    const aliases = [...css.matchAll(aliasRe)];
    expect(aliases.length).toBeGreaterThan(0); // info, accent, primary, ring… are aliases
    for (const [, , target] of aliases) {
      // a raw is "defined" when it has a literal `--target-raw: <number>` somewhere
      const definedLiteral = new RegExp(`--${target}-raw\\s*:\\s*[0-9]`).test(css);
      const definedAlias = new RegExp(`--${target}-raw\\s*:\\s*var\\(`).test(css);
      expect(definedLiteral || definedAlias, `--${target}-raw must be defined`).toBe(true);
    }
  });

  it('info is sourced from blue, accent from the neutral secondary surface (ADR 0029)', () => {
    expect(/--info-raw\s*:\s*var\(--blue-raw\)/.test(rootBlock)).toBe(true);
    expect(/--accent-raw\s*:\s*var\(--secondary-raw\)/.test(rootBlock)).toBe(true);
    // info must no longer alias magenta
    expect(/--info-raw\s*:\s*var\(--magenta-raw\)/.test(css)).toBe(false);
  });

  it('the focus ring derives from primary (no stale violet residue)', () => {
    expect(/--ring-raw\s*:\s*var\(--primary-raw\)/.test(rootBlock)).toBe(true);
    expect(/--ring-raw\s*:\s*0\.65 0\.25 301/.test(css)).toBe(false);
  });

  it('Layer 1 inks are FIXED — never re-declared in .dark', () => {
    for (const ink of LAYER1) {
      expect(definesVar(darkBlock, `${ink}-raw`), `${ink}-raw must NOT appear in .dark`).toBe(false);
    }
  });

  it('Layer 2 intents carry an explicit dark value', () => {
    for (const intent of LAYER2_ADAPTIVE) {
      expect(definesVar(darkBlock, `${intent}-raw`), `--${intent}-raw must be overridden in .dark`).toBe(true);
    }
  });

  it('exposes a 6-color data-viz palette (--chart-1..6)', () => {
    for (let i = 1; i <= 6; i++) {
      expect(definesVar(rootBlock, `chart-${i}`), `--chart-${i}`).toBe(true);
    }
  });

  it('STATUS_MAP only emits known BadgeIntent values', () => {
    const allowed = new Set(INTENTS as readonly string[]);
    const intents = [...resolvers.matchAll(/intent:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(allowed.has(intent), `STATUS_MAP intent "${intent}" is not a known BadgeIntent`).toBe(true);
    }
  });
});
