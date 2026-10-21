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
 *  - field legends (N2) share a single source: FieldLegend → text-2xs font-bold
 *  - input/select values (N3) use text-sm, no uppercase, no custom weight
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
  actionButtons: read('../../components/shared/ActionButtons.tsx'),
};

const formPrimitives = {
  fieldLegend: read('../../components/shared/FieldLegend.tsx'),
  labeledInput: read('../../components/shared/LabeledInput.tsx'),
  labeledContainer: read('../../components/shared/LabeledContainer.tsx'),
  labeledSelect: read('../../components/shared/LabeledSelect.tsx'),
};

const productDrawer = {
  productBasicInfo: read('../../features/inventory/components/product/ProductBasicInfo.tsx'),
  productTypeSelector: read('../../components/selectors/ProductTypeSelector.tsx'),
  categorySelector: read('../../components/selectors/CategorySelector.tsx'),
  uomSelector: read('../../components/selectors/UoMSelector.tsx'),
  warehouseSelector: read('../../components/selectors/WarehouseSelector.tsx'),
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
    expect(/text-3xs"?,\s*"font-black tracking-widest uppercase/.test(shell.actionButtons)).toBe(true);
    expect(/h-9 px-5 text-3xs font-black tracking-widest uppercase/.test(shell.actionButtons)).toBe(true);
  });

  describe('N2 field legends — single source via FieldLegend', () => {
    it('FieldLegend exports text-2xs font-bold uppercase tracking-widest', () => {
      const src = formPrimitives.fieldLegend;
      expect(/text-2xs font-bold uppercase tracking-widest/.test(src)).toBe(true);
      expect(/text-3xs/.test(src)).toBe(false);
    });

    it('LabeledInput delegates to FieldLegend component (no inline legend styles)', () => {
      const src = formPrimitives.labeledInput;
      expect(/<FieldLegend/.test(src)).toBe(true);
      // No inline legend class with text-2xs/text-3xs duplication
      expect(/legend className=\{cn\([^}]*"px-1\.5 text-2xs font-bold"/.test(src)).toBe(false);
    });

    it('LabeledContainer delegates to FieldLegend component (no inline legend styles)', () => {
      const src = formPrimitives.labeledContainer;
      expect(/<FieldLegend/.test(src)).toBe(true);
      // No inline legend class with text-2xs/text-3xs duplication
      expect(/legend className=\{cn\([^}]*"px-1\.5 text-(2xs|3xs) font-bold"/.test(src)).toBe(false);
    });

    it('Neither primitive uses text-3xs in legend', () => {
      for (const [name, src] of Object.entries(formPrimitives)) {
        if (name === 'fieldLegend') continue;
        // Look for legend className with text-3xs
        expect(
          /legend[^>]*className[^>]*text-3xs/.test(src),
          `${name} must not use text-3xs in legend`
        ).toBe(false);
      }
    });
  });

  describe('LabeledSelect — legend N2, trigger N3, placeholder N3', () => {
    it('LabeledSelect delegates to FieldLegend component', () => {
      const src = formPrimitives.labeledSelect;
      expect(/<FieldLegend/.test(src)).toBe(true);
      // No inline legend class with text-2xs/text-3xs duplication
      expect(/legend className=\{cn\([^}]*"px-1\.5 text-(2xs|3xs) font-bold"/.test(src)).toBe(false);
    });

    it('LabeledSelect standalone trigger uses h-6! token height (not h-[1.5rem])', () => {
      const src = formPrimitives.labeledSelect;
      expect(/h-6!/.test(src)).toBe(true);
      expect(/!h-\[1\.5rem\]/.test(src)).toBe(false);
    });

    it('LabeledSelect value uses text-sm, placeholder uses text-sm text-muted-foreground/60', () => {
      const src = formPrimitives.labeledSelect;
      // Value (SelectValue) gets text-sm text-foreground via the trigger class override
      expect(/\[&_\*:data-\[slot=select-value\]\]:text-sm/.test(src)).toBe(true);
      expect(/\[&_\*:data-\[slot=select-value\]\]:text-foreground/.test(src)).toBe(true);
      // Placeholder gets text-sm text-muted-foreground/60
      expect(/\[&_\*:data-\[placeholder\]\]:text-sm/.test(src)).toBe(true);
      expect(/\[&_\*:data-\[placeholder\]\]:text-muted-foreground\/60/.test(src)).toBe(true);
      // No font-medium on value/placeholder
      expect(/font-medium text-sm/.test(src)).toBe(false);
    });

    it('LabeledSelect inline variant stays compact for tables', () => {
      const src = formPrimitives.labeledSelect;
      expect(/h-9 text-xs/.test(src)).toBe(true);
    });
  });

  describe('Product drawer — no local overrides, selectors follow N3', () => {
    it('ProductBasicInfo has no font-bold/text-xs overrides on inputs', () => {
      const src = productDrawer.productBasicInfo;
      // No className="font-bold text-xs" on LabeledInput
      expect(/LabeledInput[^>]*className="font-bold text-xs"/.test(src)).toBe(false);
      // No className="font-mono font-bold text-xs" on LabeledInput
      expect(/LabeledInput[^>]*className="font-mono font-bold text-xs"/.test(src)).toBe(false);
      // ID display uses font-medium, not font-black
      expect(/font-mono font-black text-primary text-xs/.test(src)).toBe(false);
    });

    it('ProductTypeSelector value uses text-sm, no uppercase/font-bold', () => {
      const src = productDrawer.productTypeSelector;
      // Selected value
      expect(/text-sm text-foreground truncate leading-none.*\{selectedType\.label\}/.test(src)).toBe(true);
      // Placeholder
      expect(/text-sm text-muted-foreground\/60 leading-none.*Seleccionar tipo/.test(src)).toBe(true);
      // No uppercase, no font-bold, no text-2xs on value
      expect(/font-bold text-2xs.*\{selectedType\.label\}/.test(src)).toBe(false);
      expect(/uppercase.*\{selectedType\.label\}/.test(src)).toBe(false);
      // No arbitrary height h-[1.5rem]
      expect(/h-\[1\.5rem\]/.test(src)).toBe(false);
    });

    it('CategorySelector value uses text-sm, no uppercase/font-bold', () => {
      const src = productDrawer.categorySelector;
      // Selected value
      expect(/text-sm text-foreground truncate leading-none.*\{selectedCategory\.name\}/.test(src)).toBe(true);
      // Placeholder
      expect(/text-sm text-muted-foreground\/60 truncate leading-none.*\{placeholder\}/.test(src)).toBe(true);
      // No font-medium text-2xs uppercase on value
      expect(/font-medium text-2xs truncate uppercase.*\{selectedCategory\.name\}/.test(src)).toBe(false);
      // No text-2xs opacity-50 on placeholder
      expect(/text-2xs text-muted-foreground opacity-50.*\{placeholder\}/.test(src)).toBe(false);
      // No arbitrary height h-[1.5rem]
      expect(/h-\[1\.5rem\]/.test(src)).toBe(false);
    });

    it('UoMSelector value uses text-sm, no arbitrary height', () => {
      const src = productDrawer.uomSelector;
      // Value display - text-sm truncate with selectedUoM.name (explicit branch)
      expect(/text-sm truncate/.test(src)).toBe(true);
      expect(/selectedUoM \? selectedUoM\.name/.test(src)).toBe(false);
      // Placeholder uses text-sm text-muted-foreground/60 explicit
      expect(/text-sm text-muted-foreground\/60 truncate/.test(src)).toBe(true);
      // No arbitrary height h-[1.5rem] in standalone variant
      expect(/variant === 'standalone'[^}]*h-\[1\.5rem\]/.test(src)).toBe(false);
    });

    it('WarehouseSelector value uses text-sm, no arbitrary height', () => {
      const src = productDrawer.warehouseSelector;
      // Selected value
      expect(/text-sm text-foreground truncate leading-none.*\{selectedWarehouse\.name\}/.test(src)).toBe(true);
      // Placeholder
      expect(/text-sm text-muted-foreground\/60 truncate leading-none.*\{placeholder\}/.test(src)).toBe(true);
      // No font-medium on value
      expect(/font-medium text-sm truncate.*\{selectedWarehouse\.name\}/.test(src)).toBe(false);
      // No arbitrary height h-[1.5rem]
      expect(/h-\[1\.5rem\]/.test(src)).toBe(false);
    });
  });
});
