/**
 * pagination/datatable-needs-rowcount
 *
 * When `<DataTable manualPagination …>` is rendered, it MUST also receive
 * `rowCount={…}` (the absolute total returned by the backend) so the
 * pagination footer can show the real count.
 *
 * Without rowCount, DataTablePagination falls back to
 * `table.getFilteredRowModel().rows.length`, which in manual mode equals
 * the current page's row count (≤ pageSize). The footer ends up saying
 * "Mostrando 1 a 50 de 50" even when the backend has 350 rows, and
 * "Mostrando 51 a 50 de 50" on page 2 — the bug this rule prevents.
 *
 * See docs/20-contracts/pagination-contract.md §3.2.
 */

function getAttr(openingElement, name) {
    return openingElement.attributes?.find(
        (a) => a.type === 'JSXAttribute' && a.name?.name === name,
    );
}

const rule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                '<DataTable manualPagination /> must also pass rowCount={…} or the footer count is wrong.',
        },
        schema: [],
        messages: {
            missingRowCount:
                '<DataTable manualPagination> requires rowCount={…}. Without it, the pagination footer reads the current page length as the total. Pass rowCount={page.count} (or equivalent). See docs/20-contracts/pagination-contract.md §3.2.',
        },
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                if (node.name?.type !== 'JSXIdentifier' || node.name.name !== 'DataTable') return;
                const manual = getAttr(node, 'manualPagination');
                if (!manual) return;
                // manualPagination={false} should not trigger
                if (
                    manual.value?.type === 'JSXExpressionContainer' &&
                    manual.value.expression?.type === 'Literal' &&
                    manual.value.expression.value === false
                ) {
                    return;
                }
                const rowCount = getAttr(node, 'rowCount');
                if (rowCount) return;
                context.report({ node, messageId: 'missingRowCount' });
            },
        };
    },
};

export default rule;
