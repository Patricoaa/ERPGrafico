/**
 * Control-height roles + Interaction Guard contract (ADR-0142 D4, GOVERNANCE #17).
 * Parses `app/globals.css` as text and checks the ui primitives' class strings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cn } from '../utils';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');
const css = read('../../app/globals.css');

const ROLES: Array<[string, number]> = [['xs', 7], ['sm', 8], ['md', 9], ['lg', 10], ['touch', 12]];

describe('control height roles (ADR-0142 D4)', () => {
  for (const [role, units] of ROLES) {
    it(`--control-h-${role} is ${units} × --u (${units * 4}px at k=1)`, () => {
      expect(new RegExp(`--control-h-${role}:\\s*calc\\(var\\(--u\\) \\* ${units}\\)`).test(css)).toBe(true);
    });

    it(`h-control-${role} and size-control-${role} set the role height and the role floor`, () => {
      expect(new RegExp(`@utility h-control-${role} \\{[^}]*height: var\\(--control-h-${role}\\);[^}]*min-height: var\\(--hit-role-min\\)`).test(css)).toBe(true);
      expect(new RegExp(`@utility size-control-${role} \\{[^}]*width: var\\(--control-h-${role}\\);[^}]*height: var\\(--control-h-${role}\\);[^}]*min-height: var\\(--hit-role-min\\)`).test(css)).toBe(true);
    });
  }

  it('hit targets: 40px default, 0 in compact + fine pointer, 48px on touch', () => {
    expect(/--hit-min:\s*2\.5rem;\s*[\s\S]{0,40}--hit-role-min:\s*0px/.test(css)).toBe(true);
    expect(/\[data-input="touch"\]\s*\{[^}]*--hit-min:\s*3rem;[^}]*--hit-role-min:\s*3rem/.test(css)).toBe(true);
    expect(/@media \(pointer: fine\)\s*\{\s*\[data-density="compact"\]\s*\{\s*--hit-min:\s*0px/.test(css)).toBe(true);
  });

  it('Interaction Guard reads --hit-min (no --fitts-button-min) and keeps only the transitional h-7/8/9 exclusions', () => {
    expect(/--fitts-button-min/.test(css)).toBe(false);
    expect(/min-height:\s*var\(--hit-min\)/.test(css)).toBe(true);
    // Role controls are exempt by cascade, not by class name:
    expect(/:not\(\.h-control/.test(css)).toBe(false);
    expect(/TRANSITIONAL/.test(css)).toBe(true);
  });
});

describe('ui primitives use the roles', () => {
  const button = read('../../components/ui/button.tsx');
  const input = read('../../components/ui/input.tsx');
  const tabs = read('../../components/ui/tabs.tsx');
  const actions = read('../../components/shared/ActionButtons.tsx');

  it('Button sizes map to roles: default=lg(40) sm=md(36) lg=touch(48); icons likewise', () => {
    expect(/default: "h-control-lg /.test(button)).toBe(true);
    expect(/sm: "h-control-md /.test(button)).toBe(true);
    expect(/lg: "h-control-touch /.test(button)).toBe(true);
    expect(/icon: "size-control-lg"/.test(button)).toBe(true);
    expect(/"icon-sm": "size-control-md"/.test(button)).toBe(true);
    expect(/"icon-lg": "size-control-touch"/.test(button)).toBe(true);
  });

  it('Input, Tabs and the action buttons use roles, not literal heights', () => {
    expect(/\bh-control-lg\b/.test(input) && !/\bh-10\b/.test(input)).toBe(true);
    expect(/h-control-lg/.test(tabs) && /h-control-md/.test(tabs) && !/\bh-9\b|\bh-10\b/.test(tabs)).toBe(true);
    expect(/h-control-md px-4 text-3xs/.test(actions)).toBe(true);
    expect(/size-control-md/.test(actions)).toBe(true);
    expect(/\bh-9\b/.test(actions)).toBe(false);
  });
});

describe('cn() understands height roles (tailwind-merge extension)', () => {
  it('a later literal height overrides a role, and a later role overrides a literal', () => {
    expect(cn('h-control-lg', 'h-7')).toBe('h-7');
    expect(cn('h-7', 'h-control-md')).toBe('h-control-md');
  });
  it('size-control-* replaces width and height utilities and vice versa', () => {
    expect(cn('size-control-lg', 'size-control-md')).toBe('size-control-md');
    expect(cn('h-9 w-9', 'size-control-md')).toBe('size-control-md');
    expect(cn('size-control-lg', 'h-6')).toContain('h-6');
  });
  it('does not merge different roles of unrelated groups', () => {
    expect(cn('h-control-md', 'px-4')).toBe('h-control-md px-4');
  });
});

describe('touch variant and device-driven input axis (ADR-0142 D5)', () => {
  const TABLET = /@media \(pointer: coarse\) and \(min-width: 64rem\)/;

  it('@custom-variant touch = data-input="touch" OR tablet-class coarse pointer not forced to mouse', () => {
    const m = css.match(/@custom-variant touch \{[\s\S]*?\n\}/);
    expect(m, 'touch variant').not.toBeNull();
    const block = (m as RegExpMatchArray)[0];
    expect(/\[data-input="touch"\]/.test(block)).toBe(true);
    expect(TABLET.test(block)).toBe(true);
    expect(/:not\(\[data-input="mouse"\]/.test(block)).toBe(true);
  });

  it('the dial follows the same condition by default (no attribute) and under "auto"; "mouse" resets it', () => {
    const m = css.match(/@media \(pointer: coarse\) and \(min-width: 64rem\) \{\s*:root:not\(\[data-input="mouse"\]\),\s*\[data-input="auto"\] \{[^}]*\}/);
    expect(m, 'tablet-class dial rule').not.toBeNull();
    const rule = (m as RegExpMatchArray)[0];
    expect(/--k-input:\s*1\.125/.test(rule) && /--hit-min:\s*3rem/.test(rule) && /--hit-role-min:\s*3rem/.test(rule)).toBe(true);
    expect(/\[data-input="mouse"\]\s*\{\s*--k-input:\s*1;\s*--hit-min:\s*2\.5rem;\s*--hit-role-min:\s*0px/.test(css)).toBe(true);
  });

  it('POS cart has no JS size branches (isTouchPOS) — sizes come from the touch: variant', () => {
    const cart = read('../../features/pos/components/Cart.tsx');
    expect(/isTouchPOS|isTouchMode/.test(cart)).toBe(false);
    expect(/touch:h-14 touch:text-xl/.test(cart)).toBe(true);
  });

  it('product picker styling uses touch:, not an isTouch prop or isTouchPOS branches', () => {
    const card = read('../../components/selectors/ProductGridPicker/ProductCard.tsx');
    const filter = read('../../components/selectors/ProductGridPicker/CategoryFilter.tsx');
    expect(/\bisTouch\b/.test(card)).toBe(false);
    expect(/touch:h-9 touch:w-9/.test(card)).toBe(true);
    expect(/isTouchPOS/.test(filter)).toBe(false);
    expect(/touch:h-9 touch:px-4\.5 touch:text-xs/.test(filter)).toBe(true);
  });

  it('POSShell publishes the input mode on <html>', () => {
    expect(/useApplyInputMode\(\)/.test(read('../../features/pos/components/POSShell.tsx'))).toBe(true);
  });
});
