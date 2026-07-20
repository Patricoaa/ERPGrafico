/**
 * drawer-must-use-mode-hook
 *
 * Enforces the use of `useDrawerMode` for resolving the Drawer mode
 * instead of inline logical expressions (e.g. `modeProp ?? (initialData ? 'edit' : 'create')`).
 */
const rule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce the use of useDrawerMode hook to derive drawer modes instead of inline expressions.',
        },
        schema: [],
        messages: {
            useHook: 'Drawer mode must be derived using useDrawerMode({ mode: modeProp, initialData }). Do not resolve the mode inline. See docs/20-contracts/component-entity-drawers.md.',
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename();
        if (!filename.endsWith('Drawer.tsx')) {
            return {};
        }

        return {
            VariableDeclarator(node) {
                if (node.id.type === 'Identifier' && (node.id.name === 'mode' || node.id.name === 'isView' || node.id.name === 'isEdit' || node.id.name === 'isCreate')) {
                    if (node.init && node.init.type !== 'CallExpression' && node.init.type !== 'MemberExpression' && node.init.type !== 'Identifier' && node.init.type !== 'Literal') {
                        const sourceCode = context.sourceCode || context.getSourceCode();
                        const text = sourceCode.getText(node.init);
                        if (text.includes('modeProp') || text.includes('initialData') || text.includes('??') || text.includes('?')) {
                            context.report({ node, messageId: 'useHook' });
                        }
                    }
                }
            }
        };
    },
};

export default rule;
