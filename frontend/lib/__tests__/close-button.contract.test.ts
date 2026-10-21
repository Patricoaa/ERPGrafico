/**
 * Close Button contract test.
 *
 * Enforces that the entire codebase uses exactly ONE close button component:
 * SheetCloseButton from @/components/shared.
 *
 * Guards against drift:
 *  - SheetCloseButton exists, exports from barrel, has canonical markup
 *  - BaseModal and Drawer use PanelHeader with onClose and disable Radix's native X
 *  - No direct DialogContent/SheetContent imports outside allowlist (no ad-hoc X)
 *  - SheetCloseButton not imported directly from features (except allowlist)
 *
 * See docs/20-contracts/component-contracts.md (SheetCloseButton 🟢) and
 * ADR-0091 (to be created).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');

const shared = {
  sheetCloseButton: read('../../components/shared/SheetCloseButton.tsx'),
  panelHeader: read('../../components/shared/PanelHeader.tsx'),
  baseModal: read('../../components/shared/BaseModal.tsx'),
  drawer: read('../../components/shared/Drawer.tsx'),
  collapsibleSheet: read('../../components/shared/CollapsibleSheet.tsx'),
  universalSearch: read('../../components/shared/UniversalSearch.tsx'),
  index: read('../../components/shared/index.ts'),
};

const ui = {
  dialog: read('../../components/ui/dialog.tsx'),
  sheet: read('../../components/ui/sheet.tsx'),
};

describe('close-button contract', () => {
  describe('SheetCloseButton — canonical close button', () => {
    it('exists and exports from @/components/shared barrel', () => {
      const src = shared.index;
      expect(/export \* from ['"].\/SheetCloseButton/.test(src)).toBe(true);
    });

    it('has canonical circular ghost markup: rounded-full h-8 w-8', () => {
      const src = shared.sheetCloseButton;
      expect(/rounded-full h-8 w-8/.test(src)).toBe(true);
    });

    it('uses ghost variant with hover:bg-muted transition', () => {
      const src = shared.sheetCloseButton;
      expect(/variant="ghost"/.test(src)).toBe(true);
      expect(/hover:bg-muted/.test(src)).toBe(true);
      expect(/transition-all duration-200/.test(src)).toBe(true);
    });

    it('renders lucide X icon with h-4 w-4', () => {
      const src = shared.sheetCloseButton;
      expect(/<X className="h-4 w-4" \/>/.test(src)).toBe(true);
    });

    it('has sr-only label with default "Cerrar"', () => {
      const src = shared.sheetCloseButton;
      expect(/<span className="sr-only">\{label\}<\/span>/.test(src)).toBe(true);
      expect(/label = "Cerrar"/.test(src)).toBe(true);
    });

    it('supports optional tooltip via showTooltip prop', () => {
      const src = shared.sheetCloseButton;
      expect(/showTooltip/.test(src)).toBe(true);
      expect(/TooltipTrigger asChild/.test(src)).toBe(true);
      expect(/TooltipContent side="bottom"/.test(src)).toBe(true);
    });
  });

  describe('PanelHeader — renders SheetCloseButton when onClose provided', () => {
    it('imports SheetCloseButton from shared barrel', () => {
      const src = shared.panelHeader;
      expect(/import \{ SheetCloseButton \} from ['"]@\/components\/shared/.test(src)).toBe(true);
    });

    it('renders SheetCloseButton in centered layout when onClose provided', () => {
      const src = shared.panelHeader;
      expect(/onClose && \(/.test(src)).toBe(true);
      expect(/<SheetCloseButton/.test(src)).toBe(true);
      expect(/onClick=\{onClose\}/.test(src)).toBe(true);
      expect(/showTooltip/.test(src)).toBe(true);
    });

    it('renders SheetCloseButton in non-centered layout when onClose provided', () => {
      const src = shared.panelHeader;
      // Two render paths: centered and non-centered
      const centered = /centered.*onClose && \([\s\S]*?<SheetCloseButton/.test(src);
      const nonCentered = /onClose && \([\s\S]*?<SheetCloseButton/.test(src);
      expect(centered || nonCentered).toBe(true);
    });

    it('passes closeTooltip and closeButtonClassName to SheetCloseButton', () => {
      const src = shared.panelHeader;
      expect(/tooltipText=\{closeTooltip\}/.test(src)).toBe(true);
      expect(/className=\{cn\(.*closeButtonClassName/.test(src)).toBe(true);
    });
  });

  describe('BaseModal — uses PanelHeader with onClose, disables Radix X', () => {
    it('imports PanelHeader from shared', () => {
      const src = shared.baseModal;
      expect(/import \{ PanelHeader \} from ['"]\.\/PanelHeader/.test(src)).toBe(true);
    });

    it('passes onClose to PanelHeader when showCloseButton=true (default)', () => {
      const src = shared.baseModal;
      expect(/onClose=\{showCloseButton \? \(\) => onOpenChange\(false\) : undefined\}/.test(src)).toBe(true);
    });

    it('disables Radix DialogContent native close button', () => {
      const src = shared.baseModal;
      expect(/showCloseButton=\{false\}/.test(src)).toBe(true);
    });

    it('uses transaction variant close button styling when variant=transaction', () => {
      const src = shared.baseModal;
      expect(/isTransaction.*closeButtonClassName.*text-primary-foreground/.test(src)).toBe(true);
    });
  });

  describe('Drawer — uses PanelHeader with onClose, disables Radix X', () => {
    it('imports PanelHeader from shared', () => {
      const src = shared.drawer;
      expect(/import \{ PanelHeader \} from ['"]\.\/PanelHeader/.test(src)).toBe(true);
    });

    it('passes onClose to PanelHeader in SheetHeader', () => {
      const src = shared.drawer;
      expect(/onClose=\{\(\) => onOpenChange\(false\)\}/.test(src)).toBe(true);
    });

    it('disables Radix SheetContent native close button', () => {
      const src = shared.drawer;
      expect(/hideCloseButton=\{true\}/.test(src)).toBe(true);
    });
  });

  describe('CollapsibleSheet — intentionally hides Radix X, closes via tab', () => {
    it('hides Radix SheetContent native close button', () => {
      const src = shared.collapsibleSheet;
      expect(/hideCloseButton=\{true\}/.test(src)).toBe(true);
    });

    it('does NOT render SheetCloseButton (closes via vertical tab)', () => {
      const src = shared.collapsibleSheet;
      expect(/SheetCloseButton/.test(src)).toBe(false);
    });
  });

  describe('UniversalSearch — authorized exception, uses SheetCloseButton inline', () => {
    it('imports SheetCloseButton from shared barrel', () => {
      const src = shared.universalSearch;
      expect(/import \{.*SheetCloseButton.*\} from ['"]@\/components\/shared/.test(src)).toBe(true);
    });

    it('uses SheetCloseButton (not inline X) for close action', () => {
      const src = shared.universalSearch;
      // The close button in the search bar should use SheetCloseButton
      expect(/<SheetCloseButton/.test(src)).toBe(true);
      expect(/onClick=\{\(\) => setOpen\(false\)\}/.test(src)).toBe(true);
      expect(/label="Cerrar b[úu]squeda"/.test(src)).toBe(true);
    });
  });

  describe('No direct DialogContent/SheetContent in features/ or components/shared/', () => {
    const ALLOWLIST = [
      // These files are allowed to import DialogContent/SheetContent directly
      'components/ui/dialog.tsx',
      'components/ui/sheet.tsx',
      'components/shared/BaseModal.tsx',
      'components/shared/Drawer.tsx',
      'components/shared/CollapsibleSheet.tsx',
      'components/shared/UniversalSearch.tsx',
    ];

    function scanDir(dir: string, files: string[] = []): string[] {
      const fs = require('fs');
      const fullDir = path.resolve(here, '..', dir);
      if (!fs.existsSync(fullDir)) return files;
      for (const entry of fs.readdirSync(fullDir)) {
        const rel = path.join(dir, entry);
        const abs = path.join(fullDir, entry);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '__tests__'].includes(entry)) {
            scanDir(rel, files);
          }
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          files.push(rel);
        }
      }
      return files;
    }

    const allFiles = [
      ...scanDir('features'),
      ...scanDir('components/shared'),
    ];

    it('no file outside allowlist imports DialogContent or SheetContent from @/components/ui', () => {
      const violations: string[] = [];
      for (const rel of allFiles) {
        if (ALLOWLIST.includes(rel)) continue;
        const src = read(`../${rel}`);
        if (/from ['"]@\/components\/ui\/dialog['"].*DialogContent/.test(src) ||
            /from ['"]@\/components\/ui\/sheet['"].*SheetContent/.test(src)) {
          violations.push(rel);
        }
      }
      if (violations.length > 0) {
        console.log('VIOLATIONS:', violations.join(', '));
      }
      expect(violations, `Files importing DialogContent/SheetContent directly (use BaseModal/Drawer instead): ${violations.join(', ')}`).toEqual([]);
    });
  });

  describe('SheetCloseButton not imported directly from features/', () => {
    const FEATURE_ALLOWLIST = [
      'features/pos/components/POSReport.tsx', // existing direct usage
    ];

    function scanFeatures(dir: string, files: string[] = []): string[] {
      const fs = require('fs');
      const fullDir = path.resolve(here, '..', dir);
      if (!fs.existsSync(fullDir)) return files;
      for (const entry of fs.readdirSync(fullDir)) {
        const rel = path.join(dir, entry);
        const abs = path.join(fullDir, entry);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '__tests__'].includes(entry)) {
            scanFeatures(rel, files);
          }
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          files.push(rel);
        }
      }
      return files;
    }

    const featureFiles = scanFeatures('features');

    it('no feature file imports SheetCloseButton directly (use PanelHeader via BaseModal/Drawer)', () => {
      const violations: string[] = [];
      for (const rel of featureFiles) {
        if (FEATURE_ALLOWLIST.includes(rel)) continue;
        const src = read(`../${rel}`);
        if (/from ['"]@\/components\/shared['"].*SheetCloseButton/.test(src) ||
            /from ['"]@\/components\/shared\/SheetCloseButton['"]/.test(src)) {
          violations.push(rel);
        }
      }
      if (violations.length > 0) {
        console.log('FEATURE VIOLATIONS:', violations.join(', '));
      }
      expect(violations, `Features importing SheetCloseButton directly (should use BaseModal/Drawer → PanelHeader): ${violations.join(', ')}`).toEqual([]);
    });
  });
});