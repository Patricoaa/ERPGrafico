/**
 * Typography System contract test.
 *
 * Parses `app/globals.css`, the token-first ESLint rule and the shell/chrome
 * component sources as text (no app imports) and enforces the invariants in
 * `docs/20-contracts/typography-scale.md` (reconciliation: ADR 0082).
 *
 * Guards against the drift this test was created to prevent:
 *  - the micro N5 tokens keep their declared px values,
 *  - the mono font is JetBrains Mono,
 *  - the token-first rule keeps its forbidden raw-size map and its
 *    rem/em arbitrary-size guard,
 *  - shell chrome roles map to the documented tokens (ADR 0079/0082):
 *    nav item, breadcrumb, status pill, rail initials + tooltip, panel title,
 *  - micro-label weight is `font-bold` (N1/N2/N4) while `font-black` is
 *    reserved for action buttons (Submit/Danger/Cancel).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');

const css = read('../../app/globals.css');
const rule = read('../../eslint-rules/typography-token-first.mjs');

const shell = {
  navItem: read('../../components/layout/SidebarNavItem.tsx'),
  dashboardShell: read('../../components/layout/DashboardShell.tsx'),
  moduleRail: read('../../components/layout/ModuleRail.tsx'),
  modulePanel: read('../../components/layout/ModuleSidebarPanel.tsx'),
  panelHeader: read('../../components/shared/PanelHeader.tsx'),
  sectionHeader: read('../../components/shared/SectionHeader.tsx'),
  formSection: read('../../components/shared/FormSection.tsx'),
  actionSlideButton: read('../../components/shared/ActionSlideButton.tsx'),
  actionButtons: read('../../components/shared/ActionButtons.tsx'),
};

describe('typography contract', () => {
  it('micro N5 tokens keep their declared px values', () => {
    expect(/--text-4xs:\s*0\.5625rem/.test(css), 'text-4xs = 9px').toBe(true);
    expect(/--text-3xs:\s*0\.625rem/.test(css), 'text-3xs = 10px').toBe(true);
    expect(/--text-2xs:\s*0\.6875rem/.test(css), 'text-2xs = 11px').toBe(true);
  });

  it('mono font is JetBrains Mono', () => {
    expect(/--font-mono:\s*var\(--font-jetbrains-mono\)/.test(css)).toBe(true);
  });

  it('token-first rule forbids raw px sizes and rem/em arbitrary sizes', () => {
    expect(/FORBIDDEN_SIZES/.test(rule)).toBe(true);
    expect(/'text-\[13px\]'/.test(rule), 'text-[13px] must stay forbidden').toBe(true);
    expect(/ARBITRARY_SIZE/.test(rule), 'rem/em arbitrary-size guard present').toBe(true);
    expect(/\(\?:px\|rem\|em\)/.test(rule), 'guard covers px|rem|em').toBe(true);
  });

  it('shell chrome has no raw arbitrary font sizes', () => {
    for (const [name, src] of Object.entries(shell)) {
      expect(/text-\[\d+px\]/.test(src), `${name} must not use text-[Npx]`).toBe(false);
    }
  });

  it('nav item uses text-xs (no text-sm, no text-[13px]) — ADR 0079', () => {
    expect(/h-8 rounded-sm px-2 text-xs/.test(shell.navItem)).toBe(true);
    expect(/text-\[13px\]/.test(shell.navItem)).toBe(false);
    expect(/\btext-sm\b/.test(shell.navItem)).toBe(false);
  });

  it('topbar breadcrumb uses text-xs font-medium — ADR 0079/0082', () => {
    expect(/text-xs font-medium tracking-normal/.test(shell.dashboardShell)).toBe(true);
  });

  it('topbar status pill is uppercase tracking-wider (not tracking-tighter)', () => {
    expect(/text-2xs font-bold uppercase tracking-wider/.test(shell.dashboardShell)).toBe(true);
    expect(/text-2xs font-bold uppercase tracking-tighter/.test(shell.dashboardShell)).toBe(false);
  });

  it('rail initials are text-3xs font-bold uppercase; tooltip text-xs font-semibold', () => {
    expect(/font-bold text-3xs uppercase/.test(shell.moduleRail)).toBe(true);
    expect(/font-semibold text-xs/.test(shell.moduleRail)).toBe(true);
  });

  it('module panel title is text-sm font-semibold tracking-tight', () => {
    expect(/text-sm font-semibold tracking-tight/.test(shell.modulePanel)).toBe(true);
  });

  it('PanelHeader default title is text-sm font-semibold tracking-tight', () => {
    expect(/titleClassName = "text-sm font-semibold tracking-tight"/.test(shell.panelHeader)).toBe(true);
  });

  it('N1 section headings are font-bold (not font-black), tracking-[0.25em]', () => {
    expect(/text-2xs font-bold uppercase tracking-\[0\.25em\]/.test(shell.sectionHeader)).toBe(true);
    expect(/text-2xs font-bold uppercase tracking-\[0\.25em\]/.test(shell.formSection)).toBe(true);
    expect(/font-black/.test(shell.sectionHeader)).toBe(false);
    expect(/font-black/.test(shell.formSection)).toBe(false);
  });

  it('action buttons use font-black (Submit/Danger/Cancel share the scale)', () => {
    expect(/text-3xs"?,\s*"font-black tracking-widest uppercase/.test(shell.actionSlideButton)).toBe(true);
    expect(/h-9 px-5 text-3xs font-black tracking-widest uppercase/.test(shell.actionButtons)).toBe(true);
  });
});
