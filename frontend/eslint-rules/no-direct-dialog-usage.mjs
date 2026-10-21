/**
 * no-direct-dialog-usage
 *
 * Prohibits importing DialogContent or SheetContent directly from @/components/ui
 * in feature code and shared components. These primitives should only be used
 * by the wrapper components: BaseModal, Drawer, CollapsibleSheet, and the
 * authorized exception UniversalSearch.
 *
 * The canonical pattern is:
 *   - Modals: use BaseModal (which wraps Dialog + PanelHeader + SheetCloseButton)
 *   - Drawers: use Drawer (which wraps Sheet + PanelHeader + SheetCloseButton)
 *   - Collapsible panels: use CollapsibleSheet (hides Radix X, closes via tab)
 *
 * See docs/20-contracts/component-contracts.md (SheetCloseButton 🟢) and ADR-0091.
 */

const FORBIDDEN_IMPORTS = [
    {
        source: '@/components/ui/dialog',
        specifiers: ['DialogContent'],
        message: 'Do not import DialogContent directly. Use BaseModal from @/components/shared instead, which provides the canonical close button (SheetCloseButton) via PanelHeader.',
    },
    {
        source: '@/components/ui/sheet',
        specifiers: ['SheetContent'],
        message: 'Do not import SheetContent directly. Use Drawer or CollapsibleSheet from @/components/shared instead, which provide the canonical close button (SheetCloseButton) via PanelHeader.',
    },
];

// Allowlist: files that are allowed to import DialogContent/SheetContent directly
// These are the wrapper components and the authorized exception
const ALLOWLIST = new Set([
    'components/ui/dialog.tsx',
    'components/ui/sheet.tsx',
    'components/shared/BaseModal.tsx',
    'components/shared/Drawer.tsx',
    'components/shared/CollapsibleSheet.tsx',
    'components/shared/UniversalSearch.tsx', // authorized exception per component-modal.md
]);

function createRule(context) {
    const filename = context.getFilename();
    const relativePath = filename.replace(context.getCwd() + '/', '');

    // Skip if file is in allowlist
    if (ALLOWLIST.has(relativePath)) {
        return {};
    }

    // Skip test files
    if (relativePath.includes('__tests__') || relativePath.endsWith('.test.ts') || relativePath.endsWith('.test.tsx')) {
        return {};
    }

    return {
        ImportDeclaration(node) {
            const source = node.source.value;
            const forbidden = FORBIDDEN_IMPORTS.find(f => f.source === source);
            if (!forbidden) return;

            for (const specifier of node.specifiers) {
                if (specifier.type === 'ImportSpecifier' && forbidden.specifiers.includes(specifier.imported.name)) {
                    context.report({
                        node: specifier,
                        message: forbidden.message,
                    });
                } else if (specifier.type === 'ImportNamespaceSpecifier') {
                    // namespace import like `import * as Dialog from '@/components/ui/dialog'`
                    // We can't easily check usage, so warn on the import
                    context.report({
                        node: specifier,
                        message: `${forbidden.message} (namespace import detected)`,
                    });
                }
            }
        },
    };
}

const rule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow direct DialogContent/SheetContent imports; use BaseModal/Drawer instead',
            category: 'Best Practices',
            recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
            forbiddenDialogContent: 'Do not import DialogContent directly. Use BaseModal instead.',
            forbiddenSheetContent: 'Do not import SheetContent directly. Use Drawer instead.',
        },
    },
    create: createRule,
};

export default rule;