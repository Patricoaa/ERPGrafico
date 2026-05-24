/**
 * pagination/no-envelope-discard
 *
 * Forbids the smell `x.results || x` (and `x.results ?? x`) in feature
 * api/ and hooks/ files. That pattern silently degrades a paginated DRF
 * response into either "the array of all results" or "just the current
 * page" depending on whether the backend paginated — the consumer cannot
 * tell which, and pagination metadata (count, next, previous) is lost.
 *
 * The fix is to call frontend/lib/pagination.ts::toPage() and return
 * Page<T>. See docs/20-contracts/pagination-contract.md §2.3.
 *
 * Severity is `warn` during migration; bump to `error` when the global
 * violation count reaches 0 (audit grep in pagination-contract.md §6).
 */

function isResultsAccess(node) {
    return (
        node?.type === 'MemberExpression' &&
        !node.computed &&
        node.property?.type === 'Identifier' &&
        node.property.name === 'results'
    );
}

function sameObject(a, b) {
    if (!a || !b) return false;
    if (a.type === 'Identifier' && b.type === 'Identifier') return a.name === b.name;
    if (a.type === 'MemberExpression' && b.type === 'MemberExpression') {
        return (
            a.property.name === b.property.name &&
            sameObject(a.object, b.object)
        );
    }
    return false;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Forbid the `x.results || x` / `x.results ?? x` envelope-discard pattern. Use toPage() from @/lib/pagination instead.',
        },
        schema: [],
        messages: {
            envelopeDiscard:
                'Do not discard the DRF envelope with `x.results || x` or `x.results ?? x`. The pagination metadata (count, next, previous) is lost. Wrap with toPage() from @/lib/pagination and return Page<T>. See docs/20-contracts/pagination-contract.md §2.3.',
        },
    },
    create(context) {
        return {
            LogicalExpression(node) {
                if (node.operator !== '||' && node.operator !== '??') return;
                if (!isResultsAccess(node.left)) return;
                if (!sameObject(node.left.object, node.right)) return;
                context.report({ node, messageId: 'envelopeDiscard' });
            },
        };
    },
};
