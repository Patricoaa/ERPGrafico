/**
 * no-document-drilldown-bypass
 *
 * El drill-down documental (apilar con "volver" o navegar a la lista canónica) se decide en un único
 * sitio: `useOpenDocument` (hooks/useOpenDocument.ts, ADR-0086 / ADR-0100). Importar
 * `isListSelectionUrl` fuera de ese helper es reimplementar la regla en la superficie.
 *
 * Usar `useOpenDocument()` / `opensInApp()` en su lugar.
 */

const ALLOWLIST = new Set([
    'lib/documentNavigation.ts',
    'hooks/useOpenDocument.ts',
]);

const rule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Document drilldown must go through useOpenDocument; do not re-implement it with isListSelectionUrl',
        },
        schema: [],
    },
    create(context) {
        const relativePath = context.getFilename().replace(context.getCwd() + '/', '');
        if (
            ALLOWLIST.has(relativePath) ||
            relativePath.includes('__tests__') ||
            /\.test\.tsx?$/.test(relativePath)
        ) {
            return {};
        }

        return {
            ImportDeclaration(node) {
                if (node.source.value !== '@/lib/documentNavigation') return;
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'isListSelectionUrl') {
                        context.report({
                            node: specifier,
                            message:
                                'Do not decide document drilldown with isListSelectionUrl. Use useOpenDocument() / opensInApp() from @/hooks/useOpenDocument (ADR-0100).',
                        });
                    }
                }
            },
        };
    },
};

export default rule;
