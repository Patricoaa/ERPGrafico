/**
 * status-must-use-statusbadge
 *
 * Flags JSX expressions that render entity status values (`.status`,
 * `.status_display`, `.state`) without wrapping them in a <StatusBadge>
 * component. StatusBadge is the ONLY authorized status renderer per
 * GOVERNANCE.md §4 rule 19.
 *
 * The rule skips:
 *   - Files that import StatusBadge (they're already using it)
 *   - Expressions inside a StatusBadge JSX element
 *   - test files
 *
 * Severity is `warn` during the migration window; bump to `error` when
 * the known violation count reaches 0.
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Entity status values must be rendered with <StatusBadge>. See GOVERNANCE.md §4 rule 19.',
    },
    schema: [],
    messages: {
      useStatusBadge:
        'Render entity status with <StatusBadge> instead of raw "{{ expression }}". See GOVERNANCE.md §4 rule 19.',
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (filename.includes('.test.') || filename.includes('.spec.')) return {};

    let importsStatusBadge = false;

    return {
      ImportDeclaration(node) {
        if (node.source.value === '@/components/shared' || node.source.value === '@/components/ui/badge') {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'StatusBadge') {
              importsStatusBadge = true;
            }
          }
        }
        // Also check direct imports
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'StatusBadge') {
            importsStatusBadge = true;
          }
        }
      },

      JSXExpressionContainer(node) {
        if (importsStatusBadge) return;

        const expr = node.expression;
        if (!expr || expr.type !== 'MemberExpression' && expr.type !== 'ConditionalExpression') return;

        // Direct: {entity.status}
        if (expr.type === 'MemberExpression') {
          if (
            expr.property?.type === 'Identifier' &&
            (expr.property.name === 'status' || expr.property.name === 'status_display' || expr.property.name === 'state')
          ) {
            // Check we're NOT inside a StatusBadge
            let parent = node.parent;
            while (parent) {
              if (
                parent.type === 'JSXOpeningElement' &&
                parent.name?.type === 'JSXIdentifier' &&
                parent.name.name === 'StatusBadge'
              ) return;
              if (parent.type === 'JSXElement') break;
              parent = parent.parent;
            }

            context.report({
              node: expr,
              messageId: 'useStatusBadge',
              data: { expression: expr.property.name },
            });
          }
        }

        // Ternary: {status === 'X' ? ... : ...}
        if (expr.type === 'ConditionalExpression') {
          if (
            expr.test?.type === 'BinaryExpression' &&
            expr.test?.operator === '===' &&
            expr.test.left?.type === 'MemberExpression' &&
            expr.test.left?.property?.type === 'Identifier' &&
            (expr.test.left.property.name === 'status' || expr.test.left.property.name === 'state')
          ) {
            let parent = node.parent;
            while (parent) {
              if (
                parent.type === 'JSXOpeningElement' &&
                parent.name?.type === 'JSXIdentifier' &&
                parent.name.name === 'StatusBadge'
              ) return;
              if (parent.type === 'JSXElement') break;
              parent = parent.parent;
            }

            context.report({
              node: expr,
              messageId: 'useStatusBadge',
              data: { expression: expr.test.left.property.name },
            });
          }
        }
      },
    };
  },
};
