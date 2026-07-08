/**
 * fsd/no-api-in-component
 *
 * Disallow `import api from '@/lib/api'` (and any other import from `@/lib/api`)
 * inside `features/<feature>/components/**`. The HTTP client must only be
 * consumed from `features/<feature>/api/` (wrapped in pure functions) and
 * exposed to components via `features/<feature>/hooks/use<Entity>.ts`.
 *
 * Why a custom rule and not `no-restricted-imports`:
 *   - ESLint flat-config overwrites `no-restricted-imports` between blocks
 *     that match the same files (rule options do not merge). The existing
 *     block restricting `@tanstack/react-query` in feature components would
 *     be lost if we tried to layer `@/lib/api` on top with a different
 *     severity. A custom rule has its own name and composes cleanly.
 *
 * Severity is set at the config site (`warn` during the FSD data-layer
 * migration; bump to `error` when the global count reaches 0). See
 * docs/50-audit/fsddata/fsd-data-layer-refactor-plan.md.
 */
const rule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow importing @/lib/api inside features/*/components/**. Wrap in a feature hook (features/<feature>/hooks/use<Entity>.ts).',
        },
        schema: [],
        messages: {
            noApi:
                'Components must not import @/lib/api directly. Move the call into features/<feature>/api/<feature>Api.ts and expose it via a hook in features/<feature>/hooks/. See docs/10-architecture/frontend-fsd.md and docs/50-audit/fsddata/fsd-data-layer-refactor-plan.md.',
        },
    },
    create(context) {
        return {
            ImportDeclaration(node) {
                if (node.source.value === '@/lib/api') {
                    context.report({ node, messageId: 'noApi' });
                }
            },
        };
    },
};

export default rule;
