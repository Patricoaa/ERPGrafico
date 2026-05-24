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

/**
 * Strip parens/casts/non-null/optional-chain wrappers so we compare the
 * underlying expression. `(x as any).results ?? x` and `x.results ?? x` should
 * be treated as the same smell.
 */
function unwrap(node) {
    if (!node) return node;
    switch (node.type) {
        case 'TSAsExpression':
        case 'TSNonNullExpression':
        case 'TSTypeAssertion':
        case 'TSSatisfiesExpression':
        case 'ChainExpression':
            return unwrap(node.expression);
        default:
            return node;
    }
}

function isResultsAccess(node) {
    const n = unwrap(node);
    return (
        (n?.type === 'MemberExpression' || n?.type === 'OptionalMemberExpression') &&
        !n.computed &&
        n.property?.type === 'Identifier' &&
        n.property.name === 'results'
    );
}

function sameObject(a, b) {
    const aa = unwrap(a);
    const bb = unwrap(b);
    if (!aa || !bb) return false;
    if (aa.type === 'Identifier' && bb.type === 'Identifier') return aa.name === bb.name;
    if (
        (aa.type === 'MemberExpression' || aa.type === 'OptionalMemberExpression') &&
        (bb.type === 'MemberExpression' || bb.type === 'OptionalMemberExpression')
    ) {
        return (
            aa.property?.name === bb.property?.name &&
            sameObject(aa.object, bb.object)
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
                const leftInner = unwrap(node.left);
                if (!sameObject(leftInner.object, node.right)) return;
                context.report({ node, messageId: 'envelopeDiscard' });
            },
        };
    },
};
