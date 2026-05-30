/**
 * component-naming-suffix
 *
 * Enforces that React component files under features/ use a suffix that
 * matches their UI surface (Drawer, Modal, Sheet, Wizard, View, Form,
 * Step, Sidebar, Panel, Card, Selector, Provider, Management, etc.).
 *
 * See naming-conventions.md S 1.1 — "Component suffix must match the surface."
 * See GOVERNANCE.md S 2 rule 11.
 *
 * Files that are NOT checked:
 *   - test files
 *   - index.ts / index.tsx
 *   - files under forms/ directories (forms are surface-less)
 *   - files under skeletons/
 *
 * Severity is `warn` during migration. Existing violations are known debt
 * documented in naming-conventions.md S 7.
 */

const ALLOWED_SUFFIXES = [
  // From naming-conventions.md §1.1
  'Drawer', 'Modal', 'Sheet', 'Wizard', 'View', 'Form',
  'Step', 'Sidebar', 'Panel', 'Card', 'Selector',
  'Provider', 'Management',
  // Expanded for existing patterns
  'Phase', 'KPI', 'KPIs', 'Manager', 'Editor', 'Builder',
  'Shell', 'Columns', 'Info', 'Preview', 'Breadcrumbs',
  'Hub', 'Dashboard', 'Tabs', 'Dialog', 'Flow', 'Report',
  'Settings', 'Actions', 'Cart', 'Bell', 'Inbox',
];

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Component file export must end with an allowed surface suffix (Drawer, Modal, Sheet, etc.). See naming-conventions.md §1.1.',
    },
    schema: [],
    messages: {
      missingSuffix:
        'Component "{{ name }}" should end with a surface suffix (Drawer, Modal, Sheet, etc.). See naming-conventions.md §1.1.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Skip non-component files
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.endsWith('/index.ts') ||
      filename.endsWith('/index.tsx') ||
      !filename.includes('/components/') ||
      !filename.endsWith('.tsx')
    ) return {};

    // Skip known surface-less directories
    if (
      filename.includes('/components/forms/') ||
      filename.includes('/components/skeletons/')
    ) return {};

    // Extract the expected component name from the filename
    const basename = filename.split('/').pop().replace('.tsx', '');
    const isStepPrefix = /^Step\d+_/.test(basename);
    const hasSuffix = ALLOWED_SUFFIXES.some(s => basename.endsWith(s));

    return {
      ExportDefaultDeclaration(node) {
        if (isStepPrefix) return;
        if (hasSuffix) return;

        let name = null;
        if (node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name) {
          name = node.declaration.id.name;
        } else if (
          node.declaration?.type === 'VariableDeclaration' &&
          node.declaration.declarations[0]?.id?.name
        ) {
          name = node.declaration.declarations[0].id.name;
        }

        if (name && !ALLOWED_SUFFIXES.some(s => name.endsWith(s))) {
          context.report({
            node,
            messageId: 'missingSuffix',
            data: { name },
          });
        }
      },

      ExportNamedDeclaration(node) {
        if (isStepPrefix) return;
        if (hasSuffix) return;

        if (node.declaration?.type === 'FunctionDeclaration' && node.declaration.id?.name) {
          const name = node.declaration.id.name;
          if (!ALLOWED_SUFFIXES.some(s => name.endsWith(s)) && !name.startsWith('use')) {
            context.report({
              node,
              messageId: 'missingSuffix',
              data: { name },
            });
          }
        }
      },
    };
  },
};
